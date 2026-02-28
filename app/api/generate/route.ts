import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { editImageWithGemini } from "@/lib/gemini";
import { uploadBase64ToSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { imageItemId, imageBase64, mimeType, prompt } = await req.json();

    if (!imageItemId || !imageBase64 || !prompt) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    await prisma.imageItem.update({
      where: { id: imageItemId },
      data: { status: "processing", prompt },
    });

    const result = await editImageWithGemini(imageBase64, mimeType ?? "image/jpeg", prompt);

    const path = `${userId}/results/${imageItemId}-${Date.now()}.png`;
    const resultUrl = await uploadBase64ToSupabase(result.base64, path, result.mimeType);

    const updated = await prisma.imageItem.update({
      where: { id: imageItemId },
      data: { resultUrl, status: "done" },
    });

    return NextResponse.json({ success: true, item: updated, resultBase64: result.base64, mimeType: result.mimeType });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Generate error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
