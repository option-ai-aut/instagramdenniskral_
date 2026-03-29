import { NextRequest, NextResponse } from "next/server";
import { getDb, now } from "@/lib/db";
import { editImageWithGemini, generateTextWithGemini, IMAGE_MODEL_PRO, IMAGE_MODEL_FLASH } from "@/lib/gemini";
import { uploadBase64ToSupabase } from "@/lib/supabase";
import { requireAuth, SYSTEM_USER_ID } from "@/lib/auth";
import sharp from "sharp";

export const runtime = "nodejs";
export const maxDuration = 120; // Up to 20 images × 2 Gemini calls each can take 60–90s

const ALLOWED_IMAGE_MODELS = [IMAGE_MODEL_PRO, IMAGE_MODEL_FLASH] as const;

type ImageInput = {
  imageBase64: string;
  mimeType: string;
  imageItemId: string;
  aspectRatio?: string;
};

/**
 * Step 1 – gemini-3.1-pro-preview analyses the image + saved prompt history
 * and writes a precise, image-specific editing instruction.
 */
async function derivePromptForImage(
  imageBase64: string,
  mimeType: string,
  savedPrompts: string[]
): Promise<string> {
  const promptList = savedPrompts.map((p, i) => `${i + 1}. ${p}`).join("\n");

  try {
    const derived = await generateTextWithGemini(
      `Here are the user's past editing prompts that define their style:\n${promptList}\n\nAnalyse this image carefully and write ONE precise editing instruction (2–4 sentences) that:\n1. Identifies the subject (car, portrait, architecture, lifestyle, etc.)\n2. Picks the most relevant style preferences from the editing history above\n3. Specifies concrete changes (e.g. "Replace the car with a matte black Porsche 911 GT3, add cinematic blue-hour lighting and subtle film grain")\nReply with ONLY the editing prompt – no explanation, no preamble.`,
      {
        systemInstruction:
          "You are a creative director for an Instagram account (@denniskral_) focused on luxury lifestyle, exotic cars, and entrepreneurship. Your job is to write precise image editing instructions based on the user's style history.",
        imageBase64,
        imageMimeType: mimeType,
        thinkingLevel: "low",
      }
    );

    return derived.length > 10
      ? derived
      : "Edit this image in a luxury lifestyle style with cinematic lighting and film grain.";
  } catch {
    return "Edit this image in a luxury lifestyle style with cinematic lighting and film grain.";
  }
}

/**
 * Step 2 – gemini-3-pro-image-preview edits the image with the derived prompt.
 */
async function processImage(
  img: ImageInput,
  savedPrompts: string[],
  model: string = IMAGE_MODEL_PRO,
  imageSize: "1K" | "2K" | "4K" = "2K"
): Promise<
  | { imageItemId: string; resultBase64: string; mimeType: string; derivedPrompt: string; error?: undefined }
  | { imageItemId: string; error: string }
> {
  try {
    // Step 1: derive a custom prompt for this specific image
    const derivedPrompt = await derivePromptForImage(img.imageBase64, img.mimeType, savedPrompts);

    // Step 2: edit the image with the selected model (no aspectRatio → fast 15s generation)
    let result = await editImageWithGemini(img.imageBase64, img.mimeType, derivedPrompt, imageSize, model);

    // Post-crop to preserve input aspect ratio (<100ms, doesn't slow Gemini)
    const safeRatio = typeof img.aspectRatio === "string" && /^\d+:\d+$/.test(img.aspectRatio) ? img.aspectRatio : null;
    if (safeRatio) {
      try {
        const [rw, rh] = safeRatio.split(":").map(Number);
        if (rw > 0 && rh > 0) {
          const outBuf = Buffer.from(result.base64, "base64");
          const { width: outW = 0, height: outH = 0 } = await sharp(outBuf).metadata();
          if (outW > 0 && outH > 0) {
            const targetRatio = rw / rh;
            const outRatio    = outW / outH;
            if (Math.abs(targetRatio - outRatio) / targetRatio > 0.01) {
              let cropW: number, cropH: number;
              if (outW / targetRatio <= outH) {
                cropW = outW;  cropH = Math.round(outW / targetRatio);
              } else {
                cropH = outH;  cropW = Math.round(outH * targetRatio);
              }
              const cropped = await sharp(outBuf)
                .extract({
                  left:   Math.floor((outW - cropW) / 2),
                  top:    Math.floor((outH - cropH) / 2),
                  width:  cropW,
                  height: cropH,
                })
                .toBuffer();
              result = { base64: cropped.toString("base64"), mimeType: result.mimeType };
            }
          }
        }
      } catch (cropErr) {
        console.warn("[smart] Post-crop failed:", cropErr);
      }
    }

    const isRealDbId = !img.imageItemId.startsWith("temp-");
    const db = getDb();

    if (isRealDbId) {
      try {
        const path = `${SYSTEM_USER_ID}/results/${img.imageItemId}-${Date.now()}.png`;
        const resultUrl = await uploadBase64ToSupabase(result.base64, path, result.mimeType);
        await db
          .from("ImageItem")
          .update({ resultUrl, status: "done", prompt: derivedPrompt, updatedAt: now() })
          .eq("id", img.imageItemId);
      } catch {
        // non-fatal
      }
    }

    return {
      imageItemId: img.imageItemId,
      resultBase64: result.base64,
      mimeType: result.mimeType,
      derivedPrompt,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { imageItemId: img.imageItemId, error: message };
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { images, savedPrompts, model: modelParam, imageSize: imageSizeParam } = (await req.json()) as {
      images: ImageInput[];
      savedPrompts: string[];
      model?: string;
      imageSize?: string;
    };
    const model = ALLOWED_IMAGE_MODELS.includes(modelParam as typeof ALLOWED_IMAGE_MODELS[number])
      ? modelParam!
      : IMAGE_MODEL_PRO;
    const imageSize: "1K" | "2K" | "4K" = (["1K", "2K", "4K"] as const).includes(imageSizeParam as "1K" | "2K" | "4K") ? imageSizeParam as "1K" | "2K" | "4K" : "2K";

    if (!Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "images array is required" }, { status: 400 });
    }

    if (!Array.isArray(savedPrompts) || savedPrompts.length === 0) {
      return NextResponse.json(
        { error: "Keine gespeicherten Prompts vorhanden. Speichere zuerst einige Prompts." },
        { status: 400 }
      );
    }

    if (images.length > 20) {
      return NextResponse.json({ error: "Maximal 20 Bilder gleichzeitig" }, { status: 400 });
    }

    const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

    // Validate each image entry
    for (const img of images) {
      if (typeof img.imageItemId !== "string") {
        return NextResponse.json({ error: "imageItemId muss ein String sein" }, { status: 400 });
      }
      if (typeof img.imageBase64 !== "string" || img.imageBase64.length === 0) {
        return NextResponse.json({ error: "imageBase64 fehlt oder ist kein String" }, { status: 400 });
      }
      if (img.imageBase64.length > 14_000_000) {
        return NextResponse.json({ error: "Ein Bild ist zu groß (max 10 MB)" }, { status: 400 });
      }
      if (img.mimeType && !ALLOWED_MIMES.includes(img.mimeType)) {
        return NextResponse.json({ error: `Nicht unterstützter MIME-Typ: ${img.mimeType}` }, { status: 400 });
      }
    }

    const results = await Promise.all(images.map((img) => processImage(img, savedPrompts, model, imageSize)));

    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Smart generate error:", message);
    const clientMsg = message.includes("PERMISSION_DENIED") || message.includes("API key")
      ? "API-Fehler – bitte API-Schlüssel prüfen"
      : message.includes("quota") || message.includes("RESOURCE_EXHAUSTED")
      ? "Kontingent erschöpft – bitte später erneut versuchen"
      : "KI-Generierung fehlgeschlagen";
    return NextResponse.json({ error: clientMsg }, { status: 500 });
  }
}
