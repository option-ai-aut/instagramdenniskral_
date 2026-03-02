import { GoogleGenAI, ThinkingLevel, Modality } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

/** Image editing models */
export const IMAGE_MODEL_PRO   = "gemini-3-pro-image-preview";        // Pro  – höchste Qualität
export const IMAGE_MODEL_FLASH = "gemini-3.1-flash-image-preview";    // Flash – schneller & günstiger
/** Default image model (Pro) */
export const IMAGE_MODEL = IMAGE_MODEL_PRO;

/** Text / reasoning / prompt-writing model */
export const TEXT_MODEL = "gemini-3.1-pro-preview";

/**
 * Edit an image using gemini-3-pro-image-preview.
 * API format per official docs:
 *   - inlineData for base64 image input
 *   - config.imageConfig for output resolution
 *   - No responseModalities needed; model auto-returns image in inlineData
 */
export async function editImageWithGemini(
  imageBase64: string,
  mimeType: string,
  prompt: string,
  imageSize: "1K" | "2K" | "4K" = "2K",
  model: string = IMAGE_MODEL
): Promise<{ base64: string; mimeType: string }> {
  // NOTE: aspectRatio is intentionally NOT passed to Gemini imageConfig.
  // Passing it doubles generation time (15s → 60s+) because the model must
  // simultaneously generate content AND satisfy a strict ratio constraint.
  // Instead, the caller crops the output to the desired ratio with sharp.
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: prompt },
        ],
      },
    ],
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
      imageConfig: { imageSize },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];

  for (const part of parts) {
    if (part.inlineData?.data) {
      return {
        base64: part.inlineData.data,
        mimeType: part.inlineData.mimeType ?? "image/png",
      };
    }
  }

  throw new Error("Gemini returned no image in response");
}

/**
 * Generate text using gemini-3.1-pro-preview (with optional thinking).
 */
export async function generateTextWithGemini(
  prompt: string,
  options?: {
    systemInstruction?: string;
    imageBase64?: string;
    imageMimeType?: string;
    thinkingLevel?: "low" | "medium" | "high";
  }
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = [];

  if (options?.imageBase64) {
    parts.push({
      inlineData: {
        mimeType: options.imageMimeType ?? "image/jpeg",
        data: options.imageBase64,
      },
    });
  }
  parts.push({ text: prompt });

  const thinkingLevelMap: Record<string, ThinkingLevel> = {
    low: ThinkingLevel.LOW,
    medium: ThinkingLevel.MEDIUM,
    high: ThinkingLevel.HIGH,
  };

  const response = await ai.models.generateContent({
    model: TEXT_MODEL,
    contents: [{ role: "user", parts }],
    config: {
      ...(options?.systemInstruction
        ? { systemInstruction: options.systemInstruction }
        : {}),
      ...(options?.thinkingLevel
        ? { thinkingConfig: { thinkingLevel: thinkingLevelMap[options.thinkingLevel] } }
        : {}),
    },
  });

  const text = response.candidates?.[0]?.content?.parts
    ?.filter((p) => p.text)
    .map((p) => p.text)
    .join(" ")
    .trim();

  if (!text) throw new Error("Gemini returned no text in response");
  return text;
}
