import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, SYSTEM_USER_ID } from "@/lib/auth";

async function ensureUser() {
  try {
    await prisma.user.upsert({
      where: { id: SYSTEM_USER_ID },
      update: {},
      create: { id: SYSTEM_USER_ID, email: "dennis@denniskral.com" },
    });
  } catch (err) {
    // Non-fatal: user may already exist or DB constraint edge case
    console.error("ensureUser error:", err instanceof Error ? err.message : err);
  }
}

export async function GET() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureUser();

    const sessions = await prisma.session.findMany({
      where: { userId: SYSTEM_USER_ID },
      include: { images: { orderBy: { createdAt: "asc" } } },
      orderBy: { updatedAt: "desc" },
      take: 10,
    });

    return NextResponse.json({ sessions });
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
    await ensureUser();

    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.slice(0, 200) : "Neue Session";

    const session = await prisma.session.create({
      data: { userId: SYSTEM_USER_ID, name },
      include: { images: true },
    });

    return NextResponse.json({ session });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("POST /api/sessions error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
