import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { editImageWithGemini } from "@/lib/gemini";
import { uploadBase64ToSupabase } from "@/lib/supabase";
import { requireAuth, SYSTEM_USER_ID } from "@/lib/auth";


export async function POST(req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { imageItemId, imageBase64, mimeType, prompt } = await req.json();

    if (!imageItemId || !imageBase64 || !prompt) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (typeof prompt !== "string" || prompt.length > 2000) {
      return NextResponse.json({ error: "Prompt zu lang (max 2000 Zeichen)" }, { status: 400 });
    }

    const isRealDbId = !imageItemId.startsWith("temp-");

    if (isRealDbId) {
      try {
        await prisma.imageItem.update({
          where: { id: imageItemId },
          data: { status: "processing", prompt },
        });
      } catch {
        // Item may not exist yet – continue without DB update
      }
    }

    const result = await editImageWithGemini(imageBase64, mimeType ?? "image/jpeg", prompt);

    if (isRealDbId) {
      try {
        const path = `${SYSTEM_USER_ID}/results/${imageItemId}-${Date.now()}.png`;
        const resultUrl = await uploadBase64ToSupabase(result.base64, result.mimeType, path);
        await prisma.imageItem.update({
          where: { id: imageItemId },
          data: { resultUrl, status: "done" },
        });
      } catch {
        // DB update failure is non-fatal – result still returned to client
      }
    }

    return NextResponse.json({ success: true, resultBase64: result.base64, mimeType: result.mimeType });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Generate error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
