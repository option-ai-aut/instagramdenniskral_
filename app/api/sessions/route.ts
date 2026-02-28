import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureUser(userId);

  const sessions = await prisma.session.findMany({
    where: { userId },
    include: { images: { orderBy: { createdAt: "asc" } } },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureUser(userId);

  const body = await req.json().catch(() => ({}));
  const name = body.name ?? "Neue Session";

  const session = await prisma.session.create({
    data: { userId, name },
    include: { images: true },
  });

  return NextResponse.json({ session });
}

async function ensureUser(userId: string) {
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, email: `${userId}@clerk.local` },
  });
}
