import { NextRequest, NextResponse } from "next/server";
import { getDb, now } from "@/lib/db";
import { editImageWithGemini, generateTextWithGemini } from "@/lib/gemini";
import { uploadBase64ToSupabase } from "@/lib/supabase";
import { requireAuth, SYSTEM_USER_ID } from "@/lib/auth";

type ImageInput = {
  imageBase64: string;
  mimeType: string;
  imageItemId: string;
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
  savedPrompts: string[]
): Promise<
  | { imageItemId: string; resultBase64: string; mimeType: string; derivedPrompt: string; error?: undefined }
  | { imageItemId: string; error: string }
> {
  try {
    // Step 1: derive a custom prompt for this specific image
    const derivedPrompt = await derivePromptForImage(img.imageBase64, img.mimeType, savedPrompts);

    // Step 2: edit the image
    const result = await editImageWithGemini(img.imageBase64, img.mimeType, derivedPrompt);

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
    const { images, savedPrompts } = (await req.json()) as {
      images: ImageInput[];
      savedPrompts: string[];
    };

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

    const results = await Promise.all(images.map((img) => processImage(img, savedPrompts)));

    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Smart generate error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
