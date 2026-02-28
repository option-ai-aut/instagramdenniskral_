import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, SYSTEM_USER_ID } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try { await requireAuth(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const carousel = await prisma.carousel.findFirst({
    where: { id, userId: SYSTEM_USER_ID },
  });

  if (!carousel) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ carousel });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try { await requireAuth(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  await prisma.carousel.updateMany({
    where: { id, userId: SYSTEM_USER_ID },
    data: { title: body.title, slidesJson: body.slidesJson, thumbUrl: body.thumbUrl },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try { await requireAuth(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await prisma.carousel.deleteMany({ where: { id, userId: SYSTEM_USER_ID } });
  return NextResponse.json({ success: true });
}
