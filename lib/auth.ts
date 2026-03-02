import { cookies } from "next/headers";
import { timingSafeEqual } from "crypto";

/**
 * Constant-time string comparison using Node.js crypto.
 * Both inputs are hashed with HMAC-SHA256 to normalize to a fixed length,
 * preventing timing leaks from length differences.
 */
function safeEqual(a: string, b: string): boolean {
  try {
    const { createHmac } = require("crypto") as typeof import("crypto");
    // Use a stable app-specific secret; fall back to a hard-coded value if not set.
    // The HMAC prevents timing leaks by normalising both inputs to a fixed-length hash.
    const hmacSecret = process.env.AUTH_HMAC_SECRET ?? "instabuilder-compare-key";
    const key = Buffer.from(hmacSecret);
    const hashA = createHmac("sha256", key).update(a).digest();
    const hashB = createHmac("sha256", key).update(b).digest();
    return timingSafeEqual(hashA, hashB);
  } catch (err) {
    console.error("[auth] safeEqual failed:", err);
    return false;
  }
}

export async function requireAuth(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get("app_auth")?.value ?? "";
  const expected = process.env.APP_PASSWORD_HASH ?? process.env.APP_PASSWORD ?? "";

  if (!token || !expected || !safeEqual(token, expected)) {
    throw new Response("Unauthorized", { status: 401 });
  }
}

export const SYSTEM_USER_ID = "denniskral";
