import { GoogleGenAI, ThinkingLevel, Modality } from "@google/genai";
import sharp from "sharp";

/** Supported aspectRatio values per ImageConfig docs */
const SUPPORTED_RATIOS: { ratio: number; str: string }[] = [
  { ratio: 1 / 1,  str: "1:1"  },
  { ratio: 2 / 3,  str: "2:3"  },
  { ratio: 3 / 2,  str: "3:2"  },
  { ratio: 3 / 4,  str: "3:4"  },
  { ratio: 4 / 3,  str: "4:3"  },
  { ratio: 4 / 5,  str: "4:5"  },
  { ratio: 5 / 4,  str: "5:4"  },
  { ratio: 9 / 16, str: "9:16" },
  { ratio: 16 / 9, str: "16:9" },
  { ratio: 21 / 9, str: "21:9" },
];

function nearestAspectRatio(w: number, h: number): string {
  if (w <= 0 || h <= 0) return "1:1";
  const r = w / h;
  let best = SUPPORTED_RATIOS[0];
  let bestDiff = Math.abs(r - best.ratio);
  for (const candidate of SUPPORTED_RATIOS) {
    const diff = Math.abs(r - candidate.ratio);
    if (diff < bestDiff) { bestDiff = diff; best = candidate; }
  }
  return best.str;
}

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
  // Determine the input aspect ratio so Gemini returns the same format
  let aspectRatio = "1:1";
  try {
    const { width = 0, height = 0 } = await sharp(Buffer.from(imageBase64, "base64")).metadata();
    aspectRatio = nearestAspectRatio(width, height);
  } catch {
    // Fallback: let Gemini decide
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
      imageConfig: { imageSize, aspectRatio },
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
