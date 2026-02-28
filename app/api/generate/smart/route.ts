import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { editImageWithGemini } from "@/lib/gemini";
import { uploadBase64ToSupabase } from "@/lib/supabase";
import { requireAuth, SYSTEM_USER_ID } from "@/lib/auth";

type ImageInput = {
  imageBase64: string;
  mimeType: string;
  imageItemId: string;
};

async function processImage(
  img: ImageInput,
  savedPrompts: string[]
): Promise<{
  imageItemId: string;
  resultBase64: string;
  mimeType: string;
  derivedPrompt: string;
  error?: undefined;
} | {
  imageItemId: string;
  error: string;
}> {
  const promptList = savedPrompts
    .map((p, i) => `${i + 1}. ${p}`)
    .join("\n");

  const metaPrompt = `You are editing an image for an Instagram account focused on luxury lifestyle, cars, and entrepreneurship (@denniskral_).

The user has previously used these editing prompts – they reflect their personal style and preferences:
${promptList}

Analyze the image and apply the most fitting combination of edits based on these past preferences.
For example: if the image shows a car, apply car-related edits (e.g. swap to Porsche, cinematic lighting).
If it is a lifestyle or portrait shot, apply the matching atmosphere (e.g. golden tones, film grain).
Do not add text overlays. Return only the edited image.`;

  try {
    const result = await editImageWithGemini(img.imageBase64, img.mimeType, metaPrompt);

    let resultUrl: string | undefined;
    const isRealDbId = !img.imageItemId.startsWith("temp-");

    if (isRealDbId) {
      try {
        const path = `${SYSTEM_USER_ID}/results/${img.imageItemId}-${Date.now()}.png`;
        resultUrl = await uploadBase64ToSupabase(result.base64, result.mimeType, path);
        await prisma.imageItem.update({
          where: { id: img.imageItemId },
          data: { resultUrl, status: "done", prompt: metaPrompt },
        });
      } catch {
        // DB update failure is non-fatal
      }
    }

    return {
      imageItemId: img.imageItemId,
      resultBase64: result.base64,
      mimeType: result.mimeType,
      derivedPrompt: metaPrompt,
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
    const { images, savedPrompts } = await req.json() as {
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

    // Process all images in parallel
    const results = await Promise.all(
      images.map((img) => processImage(img, savedPrompts))
    );

    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Smart generate error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
