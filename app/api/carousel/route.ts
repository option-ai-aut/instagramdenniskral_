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
    const { data: carousels, error } = await db
      .from("Carousel")
      .select("*")
      .eq("userId", SYSTEM_USER_ID)
      .order("updatedAt", { ascending: false });

    assertNoError(error, "GET /api/carousel");
    return NextResponse.json({ carousels: carousels ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("GET /api/carousel error:", message);
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
    const { slidesJson, thumbUrl } = body;
    const title =
      typeof body.title === "string" && body.title.length <= 200
        ? body.title
        : "Neues Karussell";

    if (!slidesJson) {
      return NextResponse.json({ error: "slidesJson is required" }, { status: 400 });
    }

    const ts = now();
    const { data: carousel, error } = await db
      .from("Carousel")
      .insert({ id: newId(), userId: SYSTEM_USER_ID, title, slidesJson, thumbUrl: thumbUrl ?? null, createdAt: ts, updatedAt: ts })
      .select()
      .single();

    assertNoError(error, "POST /api/carousel");
    return NextResponse.json({ carousel });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("POST /api/carousel error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
