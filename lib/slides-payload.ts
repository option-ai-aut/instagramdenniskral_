/**
 * Shared helper for encoding/decoding the carousel slidesJson payload.
 *
 * Legacy format (v0): raw Slide[] array – grain defaults are used
 * Current format (v1): { slides: Slide[], grain: GrainSettings }
 *
 * Always backward-compatible: old saved carousels without grain keep working.
 */
import type { Slide } from "@/store/canvasStore";

export type GrainSettings = {
  intensity: number;  // 0-100
  size: number;       // 0-100
  density: number;    // 0-100
  sharpness: number;  // 0-100
};

export const DEFAULT_GRAIN: GrainSettings = {
  intensity: 0,
  size: 40,
  density: 50,
  sharpness: 50,
};

/** Parse any stored slidesJson value into slides + grain. */
export function parseSlidesPayload(raw: unknown): { slides: Slide[]; grain: GrainSettings } {
  if (Array.isArray(raw)) {
    // Legacy format – no grain stored
    return { slides: raw as Slide[], grain: { ...DEFAULT_GRAIN } };
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const slides: Slide[] = Array.isArray(obj.slides) ? (obj.slides as Slide[]) : [];
    const g = obj.grain && typeof obj.grain === "object"
      ? (obj.grain as Record<string, unknown>)
      : {};
    const grain: GrainSettings = {
      intensity: typeof g.intensity === "number" ? g.intensity : DEFAULT_GRAIN.intensity,
      size:      typeof g.size      === "number" ? g.size      : DEFAULT_GRAIN.size,
      density:   typeof g.density   === "number" ? g.density   : DEFAULT_GRAIN.density,
      sharpness: typeof g.sharpness === "number" ? g.sharpness : DEFAULT_GRAIN.sharpness,
    };
    return { slides, grain };
  }
  return { slides: [], grain: { ...DEFAULT_GRAIN } };
}

/** Build the payload object to store in slidesJson. */
export function buildSlidesPayload(slides: Slide[], grain: GrainSettings): unknown {
  return { slides, grain };
}
