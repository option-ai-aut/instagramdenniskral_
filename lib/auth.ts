import { cookies } from "next/headers";
import { timingSafeEqual } from "crypto";

/** Constant-time string comparison using Node.js crypto. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    // Pad to same length then use timingSafeEqual
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    return timingSafeEqual(bufA, bufB);
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
