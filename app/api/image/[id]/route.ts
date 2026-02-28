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

    // Verify ownership via session → user chain
    const { data: item } = await db
      .from("ImageItem")
      .select("id, Session!inner(userId)")
      .eq("id", id)
      .single();

    if (!item || (item as { Session: { userId: string } }).Session?.userId !== SYSTEM_USER_ID) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { error } = await db.from("ImageItem").delete().eq("id", id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
