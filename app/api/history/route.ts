import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, SYSTEM_USER_ID } from "@/lib/auth";

export async function GET() {
  try { await requireAuth(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [sessions, carousels] = await Promise.all([
    prisma.session.findMany({
      where: { userId: SYSTEM_USER_ID },
      include: {
        images: {
          where: { status: "done" },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.carousel.findMany({
      where: { userId: SYSTEM_USER_ID },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return NextResponse.json({ sessions, carousels });
}
