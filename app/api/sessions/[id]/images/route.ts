import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadBase64ToSupabase } from "@/lib/supabase";
import { requireAuth, SYSTEM_USER_ID } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sessionId } = await params;

  // Verify session belongs to the authenticated user
  const session = await prisma.session.findFirst({
    where: { id: sessionId, userId: SYSTEM_USER_ID },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { imageBase64, mimeType } = await req.json();

  if (!imageBase64 || typeof imageBase64 !== "string") {
    return NextResponse.json({ error: "imageBase64 is required" }, { status: 400 });
  }

  const safeMime = typeof mimeType === "string" ? mimeType : "image/jpeg";
  const path = `${SYSTEM_USER_ID}/originals/${sessionId}-${Date.now()}.jpg`;
  const originalUrl = await uploadBase64ToSupabase(imageBase64, safeMime, path);

  const item = await prisma.imageItem.create({
    data: { sessionId, originalUrl, status: "idle" },
  });

  return NextResponse.json({ item });
}
