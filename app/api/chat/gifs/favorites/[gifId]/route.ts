import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import type { ChatGifFavoritesResponse } from "@/types/chat";
import ChatUserState from "@/models/chat-user-state";

export const dynamic = "force-dynamic";

function serializeFavorites(favorites: Array<{
  provider: "giphy";
  id: string;
  title: string;
  rating: string | null;
  previewUrl: string;
  displayUrl: string;
  width: number;
  height: number;
}>): ChatGifFavoritesResponse {
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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ gifId: string }> }
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { gifId } = await params;

  try {
    await connectDB();
    const userState = await ChatUserState.findOne({ userId });
    if (!userState) {
      return NextResponse.json({ gifs: [] });
    }

    const nextFavorites = (userState.favoriteGifs ?? []).filter((favorite) => favorite.id !== gifId);
    userState.favoriteGifs = nextFavorites as never;
    await userState.save();

    return NextResponse.json(serializeFavorites(nextFavorites as never));
  } catch (error) {
    console.error("[chat gif favorites DELETE]", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
