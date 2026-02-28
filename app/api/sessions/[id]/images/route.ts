import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadBase64ToSupabase } from "@/lib/supabase";
import { requireAuth, SYSTEM_USER_ID } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try { await requireAuth(); } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sessionId } = await params;
  const { imageBase64, mimeType } = await req.json();

  const path = `${SYSTEM_USER_ID}/originals/${sessionId}-${Date.now()}.jpg`;
  const originalUrl = await uploadBase64ToSupabase(imageBase64, path, mimeType ?? "image/jpeg");

  const item = await prisma.imageItem.create({
    data: { sessionId, originalUrl, status: "idle" },
  });

  return NextResponse.json({ item });
}
