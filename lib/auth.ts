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
    async signIn({ user, account }) {
      // For OAuth sign-ins, ensure the user exists in our Mongoose users collection
      // The adapter creates entries in the native `users` collection, but our app
      // uses Mongoose models. We need to ensure consent and preferences exist.
      if (account?.provider && account.provider !== "credentials" && user?.id) {
        try {
          await connectDB();
          const existingUser = await User.findById(user.id);
          if (existingUser && !existingUser.consents?.tos?.accepted) {
            // User exists but hasn't accepted terms yet — allow sign-in,
            // proxy will redirect to accept-terms
          }
          if (!existingUser) {
            // User was created by the adapter in the native collection
            // but doesn't exist in our Mongoose collection. This shouldn't happen
            // normally, but log it for debugging.
            console.warn("[signIn] OAuth user not found in Mongoose collection:", user.id);
          }
        } catch (err) {
          console.error("[signIn] Error checking OAuth user:", err);
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
          const dbUser = await User.findById(token.sub ?? user.id).lean();
          if (dbUser) {
            token.id = dbUser._id.toString();
            token.role = dbUser.role ?? "user";
            token.emailVerified = dbUser.emailVerified ?? null;
            token.userTosVersion = dbUser.consents?.tos?.version ?? "";
            token.userPrivacyVersion = dbUser.consents?.privacy?.version ?? "";
            token.language = dbUser.preferences?.language ?? "en";
          } else {
            // Fallback for brand-new OAuth users created by the adapter
            token.role = "user";
            token.emailVerified = null;
            token.userTosVersion = "";
            token.userPrivacyVersion = "";
            token.language = "en";
          }
        } catch {
          // non-fatal — set safe defaults
          token.role = token.role ?? "user";
          token.emailVerified = token.emailVerified ?? null;
          token.userTosVersion = token.userTosVersion ?? "";
          token.userPrivacyVersion = token.userPrivacyVersion ?? "";
          token.language = token.language ?? "en";
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
