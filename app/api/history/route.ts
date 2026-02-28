import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [sessions, carousels] = await Promise.all([
    prisma.session.findMany({
      where: { userId },
      include: {
        images: {
          where: { status: "done" },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.carousel.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return NextResponse.json({ sessions, carousels });
}
