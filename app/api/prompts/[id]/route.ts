import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth, SYSTEM_USER_ID } from "@/lib/auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const db = getDb();

    const { data: existing } = await db
      .from("SavedPrompt")
      .select("id")
      .eq("id", id)
      .eq("userId", SYSTEM_USER_ID)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { error } = await db
      .from("SavedPrompt")
      .delete()
      .eq("id", id)
      .eq("userId", SYSTEM_USER_ID);

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("DELETE /api/prompts/[id] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
