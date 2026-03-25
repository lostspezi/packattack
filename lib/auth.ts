import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Discord from "next-auth/providers/discord";
import Twitch from "next-auth/providers/twitch";
import Google from "next-auth/providers/google";
import { MongoClient } from "mongodb";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import bcryptjs from "bcryptjs";
import connectDB from "@/lib/db";
import User from "@/models/user";
import PlatformSettings from "@/models/platform-settings";

// ---------------------------------------------------------------------------
// Native MongoClient for the Auth adapter (separate from Mongoose connection)
// ---------------------------------------------------------------------------
const client = new MongoClient(process.env.MONGODB_URI!);

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
  adapter: MongoDBAdapter(client),

  session: { strategy: "jwt" },

  pages: {
    signIn: "/en/login",
    error: "/en/error",
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
          language: user.preferences?.language ?? "en",
        };
      },
    }),

    Discord({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }),

    Twitch({
      clientId: process.env.TWITCH_CLIENT_ID!,
      clientSecret: process.env.TWITCH_CLIENT_SECRET!,
    }),

    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    // ------------------------------------------------------------------
    // signIn — allow all sign-ins; adapter handles account linking
    // ------------------------------------------------------------------
    async signIn() {
      return true;
    },

    // ------------------------------------------------------------------
    // jwt — called on sign-in and on every token refresh
    // ------------------------------------------------------------------
    async jwt({ token, user }) {
      // `user` is only present on the initial sign-in
      if (user) {
        // user can carry extra fields from Credentials authorize or OAuth profile
        const u = user as typeof user & {
          role?: string;
          emailVerified?: Date | null;
          userTosVersion?: string;
          userPrivacyVersion?: string;
          language?: string;
        };

        token.id = u.id ?? (u as { id?: string }).id ?? "";
        token.role = u.role ?? "user";
        token.emailVerified = u.emailVerified ?? null;
        token.userTosVersion = u.userTosVersion ?? "";
        token.userPrivacyVersion = u.userPrivacyVersion ?? "";
        token.language = u.language ?? "en";

        // For OAuth sign-ins, the above fields may not exist on the user object.
        // Fetch them from the DB using the token sub (which is the user id).
        if (!u.role) {
          try {
            await connectDB();
            const dbUser = await User.findById(token.sub).lean();
            if (dbUser) {
              token.role = dbUser.role ?? "user";
              token.emailVerified = dbUser.emailVerified ?? null;
              token.userTosVersion = dbUser.consents?.tos?.version ?? "";
              token.userPrivacyVersion = dbUser.consents?.privacy?.version ?? "";
              token.language = dbUser.preferences?.language ?? "en";
            }
          } catch {
            // non-fatal — token will carry defaults
          }
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
          const dbUser = await User.findById(token.sub).select("emailVerified consents preferences.language role").lean();
          if (dbUser) {
            token.emailVerified = dbUser.emailVerified ?? null;
            token.userTosVersion = dbUser.consents?.tos?.version ?? "";
            token.userPrivacyVersion = dbUser.consents?.privacy?.version ?? "";
            token.language = dbUser.preferences?.language ?? (token.language as string) ?? "en";
            token.role = dbUser.role ?? (token.role as string) ?? "user";
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
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
