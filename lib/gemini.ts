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
  // Read input dimensions so we can restore the exact aspect ratio afterward
  let inputW = 0;
  let inputH = 0;
  try {
    const { width = 0, height = 0 } = await sharp(Buffer.from(imageBase64, "base64")).metadata();
    inputW = width;
    inputH = height;
  } catch {
    // If sharp fails (corrupt input) we'll skip the correction below
  }

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
      const outBase64 = part.inlineData.data;
      const outMime   = part.inlineData.mimeType ?? "image/png";

      // Crop output to match input aspect ratio (Gemini often changes it)
      if (inputW > 0 && inputH > 0) {
        try {
          const outBuf = Buffer.from(outBase64, "base64");
          const { width: outW = 0, height: outH = 0 } = await sharp(outBuf).metadata();

          if (outW > 0 && outH > 0) {
            const inRatio  = inputW / inputH;
            const outRatio = outW   / outH;

            // Only correct when ratio differs by more than 1 %
            if (Math.abs(inRatio - outRatio) / inRatio > 0.01) {
              // Determine crop box that fits inside output and matches input ratio
              let cropW: number, cropH: number;
              if (outW / inRatio <= outH) {
                cropW = outW;
                cropH = Math.round(outW / inRatio);
              } else {
                cropH = outH;
                cropW = Math.round(outH * inRatio);
              }

              const corrected = await sharp(outBuf)
                .extract({
                  left:   Math.floor((outW - cropW) / 2),
                  top:    Math.floor((outH - cropH) / 2),
                  width:  cropW,
                  height: cropH,
                })
                .toBuffer();

              return { base64: corrected.toString("base64"), mimeType: outMime };
            }
          }
        } catch (err) {
          console.warn("[gemini] Aspect-ratio correction failed, returning original:", err);
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
