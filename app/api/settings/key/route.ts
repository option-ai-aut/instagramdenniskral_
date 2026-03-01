import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = process.env.OPENCLAW_API_KEY ?? "";
  return NextResponse.json({
    key,
    hint: "Use as 'Authorization: Bearer <key>' or 'X-API-Key: <key>'",
  });
}
