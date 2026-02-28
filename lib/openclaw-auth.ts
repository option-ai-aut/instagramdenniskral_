import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
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
