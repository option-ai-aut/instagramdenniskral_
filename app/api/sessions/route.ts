import { NextRequest, NextResponse } from "next/server";
import { getDb, newId, now, assertNoError } from "@/lib/db";
import { requireAuth, SYSTEM_USER_ID } from "@/lib/auth";

async function ensureUser(db: ReturnType<typeof getDb>) {
  const { error } = await db
    .from("User")
    .upsert({ id: SYSTEM_USER_ID, email: "dennis@denniskral.com" }, { onConflict: "id" });
  if (error) console.error("ensureUser:", error.message);
}

export async function GET() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    await ensureUser(db);

    const { data: sessions, error } = await db
      .from("Session")
      .select('*, images:ImageItem(*)')
      .eq("userId", SYSTEM_USER_ID)
      .order("updatedAt", { ascending: false })
      .limit(10);

    assertNoError(error, "GET /api/sessions");
    return NextResponse.json({ sessions: sessions ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("GET /api/sessions error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    await ensureUser(db);

    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.slice(0, 200) : "Neue Session";
    const ts = now();

    const { data: session, error } = await db
      .from("Session")
      .insert({ id: newId(), userId: SYSTEM_USER_ID, name, createdAt: ts, updatedAt: ts })
      .select('*, images:ImageItem(*)')
      .single();

    assertNoError(error, "POST /api/sessions");
    return NextResponse.json({ session: { ...session, images: session?.images ?? [] } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("POST /api/sessions error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
