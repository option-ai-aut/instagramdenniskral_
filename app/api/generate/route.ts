import { NextRequest, NextResponse } from "next/server";
import { getDb, now } from "@/lib/db";
import { editImageWithGemini, IMAGE_MODEL_PRO, IMAGE_MODEL_FLASH } from "@/lib/gemini";
import { uploadBase64ToSupabase } from "@/lib/supabase";
import { requireAuth, SYSTEM_USER_ID } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_IMAGE_MODELS = [IMAGE_MODEL_PRO, IMAGE_MODEL_FLASH] as const;

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { imageItemId, imageBase64, mimeType, prompt, model: modelParam, aspectRatio } = await req.json();
    const model = ALLOWED_IMAGE_MODELS.includes(modelParam) ? modelParam : IMAGE_MODEL_PRO;
    const safeAspectRatio = typeof aspectRatio === "string" && aspectRatio.length <= 8 ? aspectRatio : "1:1";

    if (!imageItemId || !imageBase64 || !prompt) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (typeof prompt !== "string" || prompt.length > 2000) {
      return NextResponse.json({ error: "Prompt zu lang (max 2000 Zeichen)" }, { status: 400 });
    }

    // Limit base64 payload to ~10 MB (base64 overhead ~1.37×)
    if (typeof imageBase64 !== "string" || imageBase64.length > 14_000_000) {
      return NextResponse.json({ error: "Bild zu groß (max 10 MB)" }, { status: 400 });
    }

    const isRealDbId = !imageItemId.startsWith("temp-");
    const db = getDb();

    if (isRealDbId) {
      await db
        .from("ImageItem")
        .update({ status: "processing", prompt, updatedAt: now() })
        .eq("id", imageItemId);
    }

    const result = await editImageWithGemini(imageBase64, mimeType ?? "image/jpeg", prompt, "2K", model, safeAspectRatio);

    if (isRealDbId) {
      try {
        const path = `${SYSTEM_USER_ID}/results/${imageItemId}-${Date.now()}.png`;
        const resultUrl = await uploadBase64ToSupabase(result.base64, path, result.mimeType);
        await db
          .from("ImageItem")
          .update({ resultUrl, status: "done", updatedAt: now() })
          .eq("id", imageItemId);
      } catch {
        // DB update failure is non-fatal – result still returned to client
      }
    }

    return NextResponse.json({ success: true, resultBase64: result.base64, mimeType: result.mimeType });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("Generate error:", message, stack);
    // Sanitize: never expose raw AI/internal error strings to the client
    const clientMsg = message.includes("PERMISSION_DENIED") || message.includes("API key")
      ? "API-Fehler – bitte API-Schlüssel prüfen"
      : message.includes("quota") || message.includes("RESOURCE_EXHAUSTED")
      ? "Kontingent erschöpft – bitte später erneut versuchen"
      : message.includes("returned no image")
      ? "KI hat kein Bild zurückgegeben – bitte Prompt anpassen"
      : "Generierung fehlgeschlagen";
    return NextResponse.json({ error: clientMsg }, { status: 500 });
  }
}
