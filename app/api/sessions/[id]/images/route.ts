import { NextRequest, NextResponse } from "next/server";
import { getDb, newId, now, assertNoError } from "@/lib/db";
import { uploadBase64ToSupabase } from "@/lib/supabase";
import { requireAuth, SYSTEM_USER_ID } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: sessionId } = await params;
    const db = getDb();

    const { data: session } = await db
      .from("Session")
      .select("id")
      .eq("id", sessionId)
      .eq("userId", SYSTEM_USER_ID)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return NextResponse.json({ error: "imageBase64 is required" }, { status: 400 });
    }

    // Limit base64 payload to ~10 MB
    if (imageBase64.length > 14_000_000) {
      return NextResponse.json({ error: "Bild zu groß (max 10 MB)" }, { status: 400 });
    }

    // MIME type whitelist
    const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const safeMime = typeof mimeType === "string" && ALLOWED_MIMES.includes(mimeType)
      ? mimeType
      : "image/jpeg";
    const ext = safeMime.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    const itemId = newId();
    const path = `${SYSTEM_USER_ID}/originals/${sessionId}-${Date.now()}.${ext}`;
    const originalUrl = await uploadBase64ToSupabase(imageBase64, path, safeMime);

    const ts = now();
    const { data: item, error } = await db
      .from("ImageItem")
      .insert({ id: itemId, sessionId, originalUrl, status: "idle", createdAt: ts, updatedAt: ts })
      .select()
      .single();

    assertNoError(error, "POST /api/sessions/[id]/images");
    return NextResponse.json({ item });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("POST sessions/images error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
