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
    const key = Buffer.from("instabuilder-compare-key");
    const hashA = createHmac("sha256", key).update(a).digest();
    const hashB = createHmac("sha256", key).update(b).digest();
    return timingSafeEqual(hashA, hashB);
  } catch {
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
