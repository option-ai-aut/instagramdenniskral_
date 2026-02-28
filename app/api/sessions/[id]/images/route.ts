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

    const safeMime = typeof mimeType === "string" ? mimeType : "image/jpeg";
    const itemId = newId();
    const path = `${SYSTEM_USER_ID}/originals/${sessionId}-${Date.now()}.jpg`;
    const originalUrl = await uploadBase64ToSupabase(imageBase64, safeMime, path);

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
