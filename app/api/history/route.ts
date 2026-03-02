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
    // Independent pagination per entity type via separate query params
    const sessionPage  = Math.max(1, parseInt(searchParams.get("sessionPage")  ?? searchParams.get("page")  ?? "1", 10));
    const carouselPage = Math.max(1, parseInt(searchParams.get("carouselPage") ?? searchParams.get("page")  ?? "1", 10));
    const limit        = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

    const sessionFrom  = (sessionPage  - 1) * limit;
    const carouselFrom = (carouselPage - 1) * limit;

    const db = getDb();

    const [sessionsResult, carouselsResult] = await Promise.all([
      db
        .from("Session")
        .select('*, images:ImageItem(*)', { count: "exact" })
        .eq("userId", SYSTEM_USER_ID)
        .order("updatedAt", { ascending: false })
        .range(sessionFrom, sessionFrom + limit - 1),
      db
        .from("Carousel")
        .select("*", { count: "exact" })
        .eq("userId", SYSTEM_USER_ID)
        .order("updatedAt", { ascending: false })
        .range(carouselFrom, carouselFrom + limit - 1),
    ]);

    const sessions = (sessionsResult.data ?? []).map((s) => ({
      ...s,
      images: (s.images ?? []).filter((img: { status: string }) => img.status === "done"),
    }));

    return NextResponse.json({
      sessions,
      carousels: carouselsResult.data ?? [],
      pagination: {
        limit,
        sessions:  { page: sessionPage,  total: sessionsResult.count  ?? 0 },
        carousels: { page: carouselPage, total: carouselsResult.count ?? 0 },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("GET /api/history error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
