import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import User from "@/models/user";
import stripe from "@/lib/stripe";

export async function POST() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session?.user || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const user = await User.findById(userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.identityVerified) {
    return NextResponse.json({ error: "Already verified" }, { status: 400 });
  }

  const lang = (session.user as { language?: string }).language || "de";

  const verificationSession = await stripe.identity.verificationSessions.create(
    {
      type: "document",
      metadata: { userId: userId },
      options: {
        document: {
          require_matching_selfie: true,
        },
      },
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/${lang}/balance?verification=complete`,
    }
  );

  user.stripeIdentityVerificationId = verificationSession.id;
  await user.save();

  return NextResponse.json({ verificationUrl: verificationSession.url });
}
