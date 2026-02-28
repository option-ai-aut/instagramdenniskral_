import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAuth, SYSTEM_USER_ID } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const db = getDb();

    const [sessionsResult, carouselsResult] = await Promise.all([
      db
        .from("Session")
        .select('*, images:ImageItem(*)')
        .eq("userId", SYSTEM_USER_ID)
        .order("updatedAt", { ascending: false })
        .range(from, to),
      db
        .from("Carousel")
        .select("*")
        .eq("userId", SYSTEM_USER_ID)
        .order("updatedAt", { ascending: false })
        .range(from, to),
    ]);

    const sessions = (sessionsResult.data ?? []).map((s) => ({
      ...s,
      images: (s.images ?? []).filter((img: { status: string }) => img.status === "done"),
    }));

    return NextResponse.json({
      sessions,
      carousels: carouselsResult.data ?? [],
      pagination: { page, limit },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("GET /api/history error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
