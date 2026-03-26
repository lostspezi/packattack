import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      emailVerified: Date | null;
      userTosVersion: string;
      userPrivacyVersion: string;
      currentTosVersion: string;
      currentPrivacyVersion: string;
      language: string;
      onboardingCompleted: boolean;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: string;
    emailVerified: Date | null;
    userTosVersion: string;
    userPrivacyVersion: string;
    currentTosVersion: string;
    currentPrivacyVersion: string;
    language: string;
    onboardingCompleted: boolean;
  }
}
