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
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  return ENCODER.encode(`event: ${event}\ndata: ${payload}\n\n`);
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
  const ctx: PackiContext = {
    username: session.user.name ?? "Freund",
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

      try {
        const anthropicStream = client.messages.stream({
          model: PACKI_MODEL,
          max_tokens: PACKI_MAX_TOKENS,
          system,
          messages,
        });

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
        if (error instanceof Anthropic.RateLimitError) {
          safeEnqueue(
            sseFrame("error", { reason: "anthropic_rate_limited" }),
          );
        } else if (error instanceof Anthropic.APIError) {
          safeEnqueue(sseFrame("error", { reason: "anthropic_error" }));
        } else {
          safeEnqueue(sseFrame("error", { reason: "internal" }));
        }
        console.error("[packi/chat]", error);
      } finally {
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
