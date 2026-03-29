import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Discord from "next-auth/providers/discord";
import Twitch from "next-auth/providers/twitch";
import Google from "next-auth/providers/google";
import { MongoClient } from "mongodb";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import bcryptjs from "bcryptjs";
import { Types } from "mongoose";
import connectDB from "@/lib/db";
import User from "@/models/user";
import PlatformSettings from "@/models/platform-settings";

async function backfillMissingUserRole(userId?: string | null, email?: string | null) {
  const filter =
    userId && Types.ObjectId.isValid(userId) && new Types.ObjectId(userId).toString() === userId
      ? { _id: new Types.ObjectId(userId) }
      : email
        ? { email }
        : null;

  if (!filter) return;

  await User.updateOne(
    {
      ...filter,
      $or: [{ role: { $exists: false } }, { role: null }],
    },
    { $set: { role: "user" } }
  );
}

// Helper: find user by ID (handles both ObjectId and UUID strings)
async function findUserById(id: string) {
  if (Types.ObjectId.isValid(id) && new Types.ObjectId(id).toString() === id) {
    return User.findById(id).lean();
  }
  // UUID from adapter — search by email via native client instead
  const client = getMongoClient();
  const db = client.db();
  const nativeUser = await db.collection("users").findOne({ _id: id as unknown as Types.ObjectId });
  if (!nativeUser) return null;
  // Try to find the Mongoose user by email
  if (nativeUser.email) {
    return User.findOne({ email: nativeUser.email }).lean();
  }
  return null;
}

// Helper: get the OAuth profile image from the adapter's native user doc
async function getAdapterUserImage(id: string): Promise<string | null> {
  try {
    const client = getMongoClient();
    const db = client.db();
    const nativeUser = await db.collection("users").findOne({ _id: id as unknown as Types.ObjectId });
    return (nativeUser?.image as string) ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Native MongoClient for the Auth adapter (separate from Mongoose connection)
// ---------------------------------------------------------------------------
let _client: MongoClient | null = null;
function getMongoClient() {
  if (!_client) {
    _client = new MongoClient(process.env.MONGODB_URI!);
  }
  return _client;
}

// ---------------------------------------------------------------------------
// Platform-settings cache — refresh at most once per 60 seconds
// ---------------------------------------------------------------------------
interface PlatformSettingsCache {
  tosVersion: string;
  privacyVersion: string;
  fetchedAt: number;
}

let platformSettingsCache: PlatformSettingsCache | null = null;
const CACHE_TTL_MS = 60_000;

export function invalidatePlatformSettingsCache() {
  platformSettingsCache = null;
}

async function getCachedPlatformSettings(): Promise<PlatformSettingsCache> {
  const now = Date.now();
  if (platformSettingsCache && now - platformSettingsCache.fetchedAt < CACHE_TTL_MS) {
    return platformSettingsCache;
  }

  await connectDB();
  const settings = await PlatformSettings.findOne().lean();
  platformSettingsCache = {
    tosVersion: settings?.tosVersion ?? "",
    privacyVersion: settings?.privacyVersion ?? "",
    fetchedAt: now,
  };
  return platformSettingsCache;
}

// ---------------------------------------------------------------------------
// NextAuth configuration
// ---------------------------------------------------------------------------
const authConfig: NextAuthConfig = {
  adapter: MongoDBAdapter(getMongoClient()),

  session: { strategy: "jwt" },

  pages: {
    signIn: "/en/login",
    error: "/en/error",
  },

  events: {
    async createUser({ user }) {
      try {
        await connectDB();
        await backfillMissingUserRole(user.id, user.email ?? null);
      } catch (error) {
        console.error("[auth createUser]", error);
      }
    },
  },

  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        await connectDB();
        const user = await User.findOne({ email: credentials.email }).select(
          "+password"
        );
        if (!user || !user.password) return null;

        const valid = await bcryptjs.compare(
          credentials.password as string,
          user.password
        );
        if (!valid) return null;

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          image: user.image ?? null,
          // Extra fields picked up by the jwt callback via the `user` param
          role: user.role,
          emailVerified: user.emailVerified ?? null,
          userTosVersion: user.consents?.tos?.version ?? "",
          userPrivacyVersion: user.consents?.privacy?.version ?? "",
          language: user.preferences?.language ?? "de",
        };
      },
    }),

    Discord({
      clientId: process.env.DISCORD_CLIENT_ID || "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
    }),

    Twitch({
      clientId: process.env.TWITCH_CLIENT_ID || "",
      clientSecret: process.env.TWITCH_CLIENT_SECRET || "",
    }),

    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],

  callbacks: {
    // ------------------------------------------------------------------
    // signIn — allow all sign-ins; adapter handles account linking
    // ------------------------------------------------------------------
    async signIn({ user, account }) {
      // Prevent OAuthAccountNotLinked from destroying the session when linking.
      // Only block if the OAuth account belongs to a DIFFERENT user.
      if (account?.provider && account.provider !== "credentials") {
        try {
          const client = getMongoClient();
          const db = client.db();
          const existingAccount = await db.collection("accounts").findOne({
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          });
          if (existingAccount) {
            // Account exists — check if it belongs to the same user (normal login) or different user (linking conflict)
            const currentUserId = user?.id ?? "";
            const ownerId = existingAccount.userId?.toString() ?? "";
            if (currentUserId && ownerId && currentUserId !== ownerId) {
              // Different user owns this account — redirect with error instead of crashing
              return `/de/account?error=OAuthAccountNotLinked`;
            }
            // Same user — this is a normal login, allow through
          }
        } catch {
          // Non-fatal, let the normal flow handle it
        }
      }
      return true;
    },

    // ------------------------------------------------------------------
    // jwt — called on sign-in and on every token refresh
    // ------------------------------------------------------------------
    async jwt({ token, user }) {
      // `user` is only present on the initial sign-in
      if (user) {
        token.id = user.id ?? "";

        // Always fetch full user data from DB on sign-in.
        // The Credentials provider passes custom fields, but OAuth providers don't.
        // DB lookup ensures we always have correct role, consents, preferences.
        try {
          await connectDB();
          const dbUser = await findUserById(token.sub ?? user.id ?? "");
          if (dbUser) {
            if (!dbUser.role) {
              await backfillMissingUserRole(dbUser._id.toString(), dbUser.email ?? null);
            }
            token.id = dbUser._id.toString();
            token.role = dbUser.role ?? "user";
            token.emailVerified = dbUser.emailVerified ?? null;
            token.userTosVersion = dbUser.consents?.tos?.version ?? "";
            token.userPrivacyVersion = dbUser.consents?.privacy?.version ?? "";
            token.language = dbUser.preferences?.language ?? "de";
            // Only override the OAuth profile picture if the user uploaded a custom avatar
            if (dbUser.image) {
              token.picture = dbUser.image;
            } else if (!token.picture) {
              token.picture = user.image ?? null;
            }
            token.onboardingCompleted = dbUser.onboardingCompleted ?? false;
          } else {
            // Fallback for brand-new OAuth users created by the adapter
            token.role = "user";
            token.emailVerified = null;
            token.userTosVersion = "";
            token.userPrivacyVersion = "";
            token.language = "de";
            token.onboardingCompleted = false;
          }
        } catch {
          // non-fatal — set safe defaults
          token.role = token.role ?? "user";
          token.emailVerified = token.emailVerified ?? null;
          token.userTosVersion = token.userTosVersion ?? "";
          token.userPrivacyVersion = token.userPrivacyVersion ?? "";
          token.language = token.language ?? "de";
          token.onboardingCompleted = token.onboardingCompleted ?? false;
        }
      }

      // Always refresh platform settings (cached) and critical user state
      try {
        const settings = await getCachedPlatformSettings();
        token.currentTosVersion = settings.tosVersion;
        token.currentPrivacyVersion = settings.privacyVersion;
      } catch {
        token.currentTosVersion = token.currentTosVersion ?? "";
        token.currentPrivacyVersion = token.currentPrivacyVersion ?? "";
      }

      // Refresh emailVerified and consent from DB on every token rotation
      // so that changes (email verification, consent acceptance) are picked up
      // without requiring a full re-login
      if (token.sub && !user) {
        try {
          await connectDB();
          const dbUser = await findUserById(token.sub ?? "");
          if (dbUser) {
            if (!dbUser.role) {
              await backfillMissingUserRole(dbUser._id.toString(), dbUser.email ?? null);
            }
            token.emailVerified = dbUser.emailVerified ?? null;
            token.userTosVersion = dbUser.consents?.tos?.version ?? "";
            token.userPrivacyVersion = dbUser.consents?.privacy?.version ?? "";
            token.language = dbUser.preferences?.language ?? (token.language as string) ?? "de";
            token.role = dbUser.role ?? (token.role as string) ?? "user";
            // Only override OAuth picture if user has a custom avatar
            if (dbUser.image) {
              token.picture = dbUser.image;
            } else if (!token.picture && token.sub) {
              // Restore OAuth profile picture from the adapter's native user doc
              token.picture = await getAdapterUserImage(token.sub);
            }
            token.onboardingCompleted = dbUser.onboardingCompleted ?? false;
          }
        } catch {
          // non-fatal — keep existing token values
        }
      }

      return token;
    },

    // ------------------------------------------------------------------
    // session — expose custom JWT fields in the client-side session
    // ------------------------------------------------------------------
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.emailVerified = token.emailVerified as Date | null;
        session.user.userTosVersion = token.userTosVersion as string;
        session.user.userPrivacyVersion = token.userPrivacyVersion as string;
        session.user.currentTosVersion = token.currentTosVersion as string;
        session.user.currentPrivacyVersion = token.currentPrivacyVersion as string;
        session.user.language = token.language as string;
        session.user.onboardingCompleted = token.onboardingCompleted as boolean;
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
