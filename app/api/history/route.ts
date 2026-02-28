import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, SYSTEM_USER_ID } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const skip = (page - 1) * limit;

  const [sessions, carousels, totalSessions, totalCarousels] = await Promise.all([
    prisma.session.findMany({
      where: { userId: SYSTEM_USER_ID },
      include: {
        images: {
          where: { status: "done" },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.carousel.findMany({
      where: { userId: SYSTEM_USER_ID },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.session.count({ where: { userId: SYSTEM_USER_ID } }),
    prisma.carousel.count({ where: { userId: SYSTEM_USER_ID } }),
  ]);

  return NextResponse.json({
    sessions,
    carousels,
    pagination: {
      page,
      limit,
      totalSessions,
      totalCarousels,
    },
  });
}
