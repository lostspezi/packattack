import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const locales = ["de", "en"];
const defaultLocale = "en";

const authRoutes = ["/login", "/register", "/verify-email", "/accept-terms", "/onboarding", "/error", "/forgot-password", "/reset-password"];

function getLocaleFromPath(pathname: string): string | null {
  const segment = pathname.split("/")[1];
  return locales.includes(segment) ? segment : null;
}

function getPreferredLocale(request: NextRequest): string {
  const acceptLang = request.headers.get("accept-language") || "";
  if (acceptLang.includes("de")) return "de";
  return defaultLocale;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes, static files, Next.js internals
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 1. Locale detection & redirect
  const locale = getLocaleFromPath(pathname);
  if (!locale) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET, secureCookie: request.nextUrl.protocol === "https:" });
    const preferredLang = (token?.language as string) || getPreferredLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = `/${preferredLang}${pathname}`;
    return NextResponse.redirect(url);
  }

  // Path without locale prefix
  const pathWithoutLocale = pathname.replace(`/${locale}`, "") || "/";

  // 2. Auth routes — allow through
  if (authRoutes.some((route) => pathWithoutLocale.startsWith(route))) {
    return NextResponse.next();
  }

  // 3. Auth check
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET, secureCookie: request.nextUrl.protocol === "https:" });

  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  // 4. Email verification check
  if (!token.emailVerified) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/verify-email`;
    return NextResponse.redirect(url);
  }

  // 5. Onboarding check
  if (!token.onboardingCompleted) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/onboarding`;
    return NextResponse.redirect(url);
  }

  // 6. Consent check
  if (
    token.userTosVersion !== token.currentTosVersion ||
    token.userPrivacyVersion !== token.currentPrivacyVersion
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/accept-terms`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
