import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  assertPackiMessageAllowed,
  PACKI_DAILY_LIMIT,
} from "@/lib/packi/rate-limit";
import {
  appendPackiTurns,
  loadPackiSession,
  type PackiTurn,
} from "@/lib/packi/session";
import {
  sanitizePackiMessage,
  validatePackiInput,
  scrubPackiOutput,
} from "@/lib/packi/guardrails";
import {
  buildSystemBlocks,
  PACKI_MAX_TOKENS,
  PACKI_MODEL,
  type PackiContext,
} from "@/lib/packi/system-prompt";
import {
  buildCorrectionsBlock,
  loadPackiCorrections,
} from "@/lib/packi/corrections";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ChatRequestBody {
  message?: unknown;
  route?: unknown;
}

const ENCODER = new TextEncoder();

function sseFrame(event: string, data: unknown): Uint8Array {
  // Always JSON-encode. Keeps client-side parsing uniform across frame types
  // (otherwise the client JSON.parse throws for every raw-string token frame).
  return ENCODER.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function jsonError(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function buildHistoryMessages(
  turns: PackiTurn[],
  newUserMessage: string,
): Anthropic.MessageParam[] {
  return [
    ...turns.map((t) => ({ role: t.role, content: t.content })),
    { role: "user" as const, content: newUserMessage },
  ];
}

let cachedClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!cachedClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    cachedClient = new Anthropic({ apiKey });
  }
  return cachedClient;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return jsonError(401, { error: "unauthorized" });
  }

  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return jsonError(400, { error: "invalid_json" });
  }

  const validation = validatePackiInput(body.message, body.route);
  if (!validation.ok || !validation.sanitized) {
    return jsonError(400, { error: validation.reason ?? "invalid_input" });
  }

  const userId = session.user.id;
  const rate = await assertPackiMessageAllowed(userId);
  if (!rate.allowed) {
    return jsonError(429, {
      error: "rate_limited",
      limit: PACKI_DAILY_LIMIT,
      retryAfterSeconds: rate.retryAfterSeconds,
    });
  }

  let client: Anthropic;
  try {
    client = getAnthropic();
  } catch {
    return jsonError(503, { error: "packi_offline" });
  }

  const userMessage = validation.sanitized;
  const route = body.route as string;
  // Display names are attacker-controlled. Strip injection markers before
  // interpolating into the system prompt's context block.
  const rawName = session.user.name ?? "Freund";
  const username = sanitizePackiMessage(rawName) || "Freund";
  const ctx: PackiContext = {
    username,
    lang: (session.user.language as string | undefined) ?? "de",
    route,
    onboardingCompleted: Boolean(session.user.onboardingCompleted),
    tourCompleted: false,
  };

  const [prior, corrections] = await Promise.all([
    loadPackiSession(userId),
    loadPackiCorrections(ctx.lang),
  ]);
  const messages = buildHistoryMessages(prior, userMessage);
  const system = buildSystemBlocks(ctx, buildCorrectionsBlock(corrections));

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const collected: string[] = [];
      let closed = false;
      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          closed = true;
        }
      };

      safeEnqueue(sseFrame("meta", { remaining: rate.remaining }));

      // Propagate client cancellation to Anthropic so a closed connection
      // stops billing immediately instead of draining the full max_tokens.
      const abortSignal = req.signal;
      const onClientAbort = () => {
        anthropicStream?.abort();
      };
      let anthropicStream: ReturnType<typeof client.messages.stream> | null =
        null;

      try {
        anthropicStream = client.messages.stream(
          {
            model: PACKI_MODEL,
            max_tokens: PACKI_MAX_TOKENS,
            system,
            messages,
          },
          { signal: abortSignal },
        );
        abortSignal?.addEventListener("abort", onClientAbort, { once: true });

        for await (const event of anthropicStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const delta = event.delta.text;
            if (delta) {
              collected.push(delta);
              safeEnqueue(sseFrame("token", delta));
            }
          }
        }

        const final = await anthropicStream.finalMessage();
        const assistantText = scrubPackiOutput(collected.join(""));
        safeEnqueue(
          sseFrame("done", {
            stopReason: final.stop_reason,
            usage: final.usage,
          }),
        );

        if (assistantText) {
          await appendPackiTurns(userId, prior, [
            { role: "user", content: userMessage, ts: Date.now() },
            { role: "assistant", content: assistantText, ts: Date.now() },
          ]);
        }
      } catch (error) {
        const isClientAbort =
          abortSignal?.aborted ||
          (error instanceof DOMException && error.name === "AbortError") ||
          (error instanceof Error && error.name === "AbortError");

        if (isClientAbort) {
          // Client went away (closed panel / navigated). No error frame,
          // no log — this is normal cancellation, stream is done.
        } else if (error instanceof Anthropic.RateLimitError) {
          safeEnqueue(
            sseFrame("error", { reason: "anthropic_rate_limited" }),
          );
        } else if (error instanceof Anthropic.APIError) {
          safeEnqueue(sseFrame("error", { reason: "anthropic_error" }));
        } else {
          safeEnqueue(sseFrame("error", { reason: "internal" }));
        }
        if (!isClientAbort) console.error("[packi/chat]", error);
      } finally {
        abortSignal?.removeEventListener("abort", onClientAbort);
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
