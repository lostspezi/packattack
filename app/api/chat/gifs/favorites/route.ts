import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { sanitizeIncomingChatGif } from "@/lib/giphy";
import { chatGifSchema } from "@/lib/validations";
import type { ChatGifFavoritesResponse, ChatGifSummary } from "@/types/chat";
import User from "@/models/user";
import { ensureChatUserState } from "@/lib/chat";

export const dynamic = "force-dynamic";

const FAVORITE_LIMIT = 50;

function serializeFavorites(
  favorites: Array<
    ChatGifSummary & {
      savedAt?: Date;
    }
  >
): ChatGifFavoritesResponse {
  return {
    gifs: favorites.map((gif) => ({
      provider: gif.provider,
      id: gif.id,
      title: gif.title,
      rating: gif.rating ?? null,
      previewUrl: gif.previewUrl,
      displayUrl: gif.displayUrl,
      width: gif.width,
      height: gif.height,
    })),
  };
}

async function loadChatUserState(userId: string) {
  await connectDB();
  const user = await User.findById(userId).lean();
  if (!user) {
    return null;
  }

  return ensureChatUserState(user as never);
}

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userState = await loadChatUserState(userId);
    if (!userState) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      serializeFavorites(
        [...(userState.favoriteGifs ?? [])].sort(
          (left, right) =>
            new Date(right.savedAt ?? 0).getTime() - new Date(left.savedAt ?? 0).getTime()
        ) as never
      )
    );
  } catch (error) {
    console.error("[chat gif favorites GET]", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = chatGifSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const gif = sanitizeIncomingChatGif(parsed.data);
  if (!gif) {
    return NextResponse.json({ error: "invalid_gif" }, { status: 400 });
  }

  try {
    const userState = await loadChatUserState(userId);
    if (!userState) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const nextFavorites = [
      {
        ...gif,
        savedAt: new Date(),
      },
      ...(userState.favoriteGifs ?? []).filter(
        (favorite) => !(favorite.provider === gif.provider && favorite.id === gif.id)
      ),
    ].slice(0, FAVORITE_LIMIT);

    userState.favoriteGifs = nextFavorites as never;
    await userState.save();

    return NextResponse.json(serializeFavorites(nextFavorites as never));
  } catch (error) {
    console.error("[chat gif favorites POST]", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
