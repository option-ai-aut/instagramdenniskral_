import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadBase64ToSupabase } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: sessionId } = await params;
  const { imageBase64, mimeType } = await req.json();

  const path = `${userId}/originals/${sessionId}-${Date.now()}.jpg`;
  const originalUrl = await uploadBase64ToSupabase(imageBase64, path, mimeType ?? "image/jpeg");

  const item = await prisma.imageItem.create({
    data: { sessionId, originalUrl, status: "idle" },
  });

  return NextResponse.json({ item });
}
