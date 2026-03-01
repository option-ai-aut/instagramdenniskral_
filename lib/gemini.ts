import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

/** Image editing model – gemini-3-pro-image-preview (Nano Banana Pro) */
export const IMAGE_MODEL = "gemini-3-pro-image-preview";

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
  imageSize: "1K" | "2K" | "4K" = "1K"
): Promise<{ base64: string; mimeType: string }> {
  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      imageConfig: { imageSize } as any,
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
