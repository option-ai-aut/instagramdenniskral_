import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, SYSTEM_USER_ID } from "@/lib/auth";

async function ensureUser() {
  await prisma.user.upsert({
    where: { id: SYSTEM_USER_ID },
    update: {},
    create: { id: SYSTEM_USER_ID, email: "dennis@denniskral.com" },
  });
}

export async function GET() {
  try { await requireAuth(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const carousels = await prisma.carousel.findMany({
    where: { userId: SYSTEM_USER_ID },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ carousels });
}

export async function POST(req: NextRequest) {
  try { await requireAuth(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureUser();

  const body = await req.json().catch(() => ({}));
  const { slidesJson, thumbUrl } = body;
  const title =
    typeof body.title === "string" && body.title.length <= 200
      ? body.title
      : "Neues Karussell";

  if (!slidesJson) {
    return NextResponse.json({ error: "slidesJson is required" }, { status: 400 });
  }

  const carousel = await prisma.carousel.create({
    data: { userId: SYSTEM_USER_ID, title, slidesJson, thumbUrl },
  });

  return NextResponse.json({ carousel });
}
