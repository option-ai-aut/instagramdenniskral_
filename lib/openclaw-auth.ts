import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

/**
 * Constant-time comparison: both inputs are HMAC-SHA256 hashed first
 * to normalize to fixed length and prevent timing leaks.
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

/**
 * Validates the incoming request's API key.
 * Accepts either:
 *   Authorization: Bearer <key>
 *   X-API-Key: <key>
 *
 * Returns null on success, or an error NextResponse on failure.
 */
export function validateOpenclaw(req: NextRequest): NextResponse | null {
  const expected = process.env.OPENCLAW_API_KEY;
  if (!expected) {
    return NextResponse.json({ error: "API key not configured on server" }, { status: 503 });
  }

  const auth = req.headers.get("authorization") ?? "";
  const xApiKey = req.headers.get("x-api-key") ?? "";

  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const provided = bearer || xApiKey;

  if (!provided || !safeEqual(provided, expected)) {
    return NextResponse.json(
      { error: "Unauthorized – provide a valid API key via 'Authorization: Bearer <key>' or 'X-API-Key: <key>'" },
      { status: 401 }
    );
  }

  return null; // OK
}
