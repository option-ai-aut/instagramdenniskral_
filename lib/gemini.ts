import { GoogleGenAI, ThinkingLevel, Modality } from "@google/genai";
import sharp from "sharp";

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
      const outMime   = part.inlineData.mimeType ?? "image/png";
      const outBase64 = part.inlineData.data;

      // Gemini always returns PNG – convert back to the input format when possible
      const SUPPORTED = ["image/jpeg", "image/png", "image/webp"];
      if (outMime !== mimeType && SUPPORTED.includes(mimeType)) {
        try {
          const buf = Buffer.from(outBase64, "base64");
          let converted: Buffer;
          if (mimeType === "image/jpeg") {
            converted = await sharp(buf).jpeg({ quality: 92 }).toBuffer();
          } else if (mimeType === "image/webp") {
            converted = await sharp(buf).webp({ quality: 92 }).toBuffer();
          } else {
            converted = await sharp(buf).png().toBuffer();
          }
          return { base64: converted.toString("base64"), mimeType };
        } catch (convErr) {
          console.warn("[gemini] Format conversion failed, returning Gemini's format:", convErr);
          return { base64: outBase64, mimeType: outMime };
        }
      }

      return { base64: outBase64, mimeType: outMime };
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
