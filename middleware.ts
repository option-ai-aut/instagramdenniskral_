import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/openclaw",   // Openclaw API has its own API-key auth
];
const AUTH_COOKIE = "app_auth";

/**
 * Constant-time string comparison for Edge Runtime.
 * Both inputs are padded to a fixed 512-byte buffer to prevent length-based timing leaks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const MAX = 512;
  const pad = (s: string) => {
    const buf = new Uint8Array(MAX);
    const encoded = encoder.encode(s.slice(0, MAX));
    buf.set(encoded);
    return buf;
  };
  const bufA = pad(a);
  const bufB = pad(b);
  let diff = 0;
  for (let i = 0; i < MAX; i++) {
    diff |= bufA[i] ^ bufB[i];
  }
  // Also verify lengths match (constant-time XOR)
  diff |= a.length ^ b.length;
  return diff === 0;
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(AUTH_COOKIE);
  // BUG-03 fix: fall back to APP_PASSWORD if APP_PASSWORD_HASH is not set
  const expected = process.env.APP_PASSWORD_HASH ?? process.env.APP_PASSWORD ?? "";

  if (cookie?.value && expected && timingSafeEqual(cookie.value, expected)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
