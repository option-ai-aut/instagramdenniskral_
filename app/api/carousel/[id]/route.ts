import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const carousel = await prisma.carousel.findFirst({
    where: { id, userId },
  });

  if (!carousel) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ carousel });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const carousel = await prisma.carousel.updateMany({
    where: { id, userId },
    data: {
      title: body.title,
      slidesJson: body.slidesJson,
      thumbUrl: body.thumbUrl,
    },
  });

  return NextResponse.json({ carousel });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.carousel.deleteMany({ where: { id, userId } });
  return NextResponse.json({ success: true });
}
