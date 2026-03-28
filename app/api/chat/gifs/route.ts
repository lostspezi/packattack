import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchChatGifs, isGiphyEnabled } from "@/lib/giphy";
import type { ChatGifPickerResponse } from "@/types/chat";

export const dynamic = "force-dynamic";

function parseOffset(value: string | null) {
  const parsed = value ? Number.parseInt(value, 10) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function buildEmptyResponse(
  mode: "trending" | "search",
  query: string,
  offset: number
): ChatGifPickerResponse {
  return {
    gifs: [],
    mode,
    query,
    offset,
    nextOffset: null,
    total: 0,
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const requestedMode = url.searchParams.get("mode") === "search" ? "search" : "trending";
  const mode = query ? "search" : requestedMode;
  const offset = parseOffset(url.searchParams.get("offset"));

  try {
    if (!isGiphyEnabled()) {
      return NextResponse.json(buildEmptyResponse(mode, query, offset));
    }

    const payload = await fetchChatGifs({ mode, query, offset });
    return NextResponse.json(payload ?? buildEmptyResponse(mode, query, offset));
  } catch (error) {
    console.error("[chat gifs GET]", error);
    return NextResponse.json(buildEmptyResponse(mode, query, offset));
  }
}
