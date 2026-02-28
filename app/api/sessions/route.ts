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

  await ensureUser();

  const sessions = await prisma.session.findMany({
    where: { userId: SYSTEM_USER_ID },
    include: { images: { orderBy: { createdAt: "asc" } } },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
  try { await requireAuth(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureUser();

  const body = await req.json().catch(() => ({}));
  const name = body.name ?? "Neue Session";

  const session = await prisma.session.create({
    data: { userId: SYSTEM_USER_ID, name },
    include: { images: true },
  });

  return NextResponse.json({ session });
}
