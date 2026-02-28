import { NextRequest, NextResponse } from "next/server";
import { getDb, now } from "@/lib/db";
import { requireAuth, SYSTEM_USER_ID } from "@/lib/auth";

export async function GET(
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

    const { data: carousel, error } = await db
      .from("Carousel")
      .select("*")
      .eq("id", id)
      .eq("userId", SYSTEM_USER_ID)
      .single();

    if (error || !carousel) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ carousel });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const db = getDb();

    const updates: Record<string, unknown> = { updatedAt: now() };
    if (typeof body.title === "string") updates.title = body.title.slice(0, 200);
    if (body.slidesJson !== undefined) updates.slidesJson = body.slidesJson;
    if (body.thumbUrl !== undefined) updates.thumbUrl = body.thumbUrl;

    const { error } = await db
      .from("Carousel")
      .update(updates)
      .eq("id", id)
      .eq("userId", SYSTEM_USER_ID);

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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

    const { error } = await db
      .from("Carousel")
      .delete()
      .eq("id", id)
      .eq("userId", SYSTEM_USER_ID);

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
