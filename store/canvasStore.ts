import { create } from "zustand";
import { nanoid } from "@/lib/nanoid";

export type TextAlign = "left" | "center" | "right";
export type FontWeight = "normal" | "medium" | "semibold" | "bold" | "extrabold";

export type TextElement = {
  id: string;
  type: "header" | "subtitle" | "body" | "tag";
  text: string;
  fontSize: number;
  fontWeight: FontWeight;
  fontFamily: string;
  color: string;
  align: TextAlign;
  x: number;
  y: number;
  /** Vertical anchor: where Y% is pinned. "top" = top edge, "center" = middle (default), "bottom" = bottom edge */
  verticalAnchor?: "top" | "center" | "bottom";
  /** When true the element is fixed/anchored – Openclaw textOverrides cannot change it */
  locked?: boolean;
};

export type SlideBackground = {
  type: "solid" | "gradient" | "image";
  color?: string;
  gradient?: string;
  imageUrl?: string;
};

export type Slide = {
  id: string;
  background: SlideBackground;
  elements: TextElement[];
  aspectRatio: "1:1" | "4:5" | "9:16";
};

export type Template = {
  id: string;
  name: string;
  slides: Slide[];
};

const TEMPLATES: Template[] = [
  {
    id: "progress",
    name: "Progress Update",
    slides: [
      {
        id: nanoid(),
        background: { type: "gradient", gradient: "linear-gradient(135deg, #0a0a0f 0%, #111118 100%)" },
        aspectRatio: "4:5",
        elements: [
          { id: nanoid(), type: "tag", text: "BUILD IN PUBLIC", fontSize: 11, fontWeight: "semibold", fontFamily: "Montserrat", color: "#60a5fa", align: "center", x: 50, y: 15 },
          { id: nanoid(), type: "header", text: "Was ich diese Woche gebaut habe", fontSize: 32, fontWeight: "extrabold", fontFamily: "Playfair Display", color: "#ffffff", align: "center", x: 50, y: 40 },
          { id: nanoid(), type: "subtitle", text: "Von 0 auf 1.000 Nutzer in 30 Tagen", fontSize: 16, fontWeight: "normal", fontFamily: "Inter", color: "rgba(255,255,255,0.6)", align: "center", x: 50, y: 62 },
          { id: nanoid(), type: "body", text: "@denniskral_", fontSize: 12, fontWeight: "medium", fontFamily: "Inter", color: "rgba(255,255,255,0.3)", align: "center", x: 50, y: 88 },
        ],
      },
    ],
  },
  {
    id: "tip",
    name: "Hilfreicher Tipp",
    slides: [
      {
        id: nanoid(),
        background: { type: "gradient", gradient: "linear-gradient(135deg, #0a0a0f 0%, #0f1a24 100%)" },
        aspectRatio: "4:5",
        elements: [
          { id: nanoid(), type: "tag", text: "PRO TIPP", fontSize: 11, fontWeight: "semibold", fontFamily: "Montserrat", color: "#34d399", align: "center", x: 50, y: 15 },
          { id: nanoid(), type: "header", text: "Dein Titel hier", fontSize: 34, fontWeight: "extrabold", fontFamily: "Bebas Neue", color: "#ffffff", align: "center", x: 50, y: 40 },
          { id: nanoid(), type: "subtitle", text: "Kurze prägnante Beschreibung in 1-2 Sätzen.", fontSize: 15, fontWeight: "normal", fontFamily: "Poppins", color: "rgba(255,255,255,0.55)", align: "center", x: 50, y: 64 },
          { id: nanoid(), type: "body", text: "@denniskral_", fontSize: 12, fontWeight: "medium", fontFamily: "Inter", color: "rgba(255,255,255,0.3)", align: "center", x: 50, y: 88 },
        ],
      },
    ],
  },
  {
    id: "luxury",
    name: "Luxury Lifestyle",
    slides: [
      {
        id: nanoid(),
        background: { type: "gradient", gradient: "linear-gradient(160deg, #0a0a0f 0%, #1a1500 60%, #0a0a0f 100%)" },
        aspectRatio: "4:5",
        elements: [
          { id: nanoid(), type: "tag", text: "LUXURY · CARS · LIFESTYLE", fontSize: 10, fontWeight: "semibold", fontFamily: "Cinzel", color: "#fbbf24", align: "center", x: 50, y: 15 },
          { id: nanoid(), type: "header", text: "Dein Headline", fontSize: 36, fontWeight: "bold", fontFamily: "Cormorant Garamond", color: "#ffffff", align: "center", x: 50, y: 42 },
          { id: nanoid(), type: "subtitle", text: "Subtitel oder Zitat kommt hier hin.", fontSize: 15, fontWeight: "normal", fontFamily: "Lora", color: "rgba(255,255,255,0.5)", align: "center", x: 50, y: 63 },
          { id: nanoid(), type: "body", text: "@denniskral_", fontSize: 12, fontWeight: "medium", fontFamily: "Inter", color: "rgba(255,255,255,0.25)", align: "center", x: 50, y: 88 },
        ],
      },
    ],
  },
];

function makeDefaultSlide(): Slide {
  return {
    id: nanoid(),
    background: { type: "gradient", gradient: "linear-gradient(135deg, #0a0a0f 0%, #111118 100%)" },
    aspectRatio: "4:5",
    elements: [
      { id: nanoid(), type: "header", text: "Dein Titel", fontSize: 32, fontWeight: "extrabold", fontFamily: "Playfair Display", color: "#ffffff", align: "center", x: 50, y: 40 },
      { id: nanoid(), type: "subtitle", text: "Subtitel hier", fontSize: 16, fontWeight: "normal", fontFamily: "Inter", color: "rgba(255,255,255,0.55)", align: "center", x: 50, y: 60 },
      { id: nanoid(), type: "body", text: "@denniskral_", fontSize: 12, fontWeight: "medium", fontFamily: "Inter", color: "rgba(255,255,255,0.3)", align: "center", x: 50, y: 88 },
    ],
  };
}

type CanvasStore = {
  slides: Slide[];
  selectedSlideId: string | null;
  selectedElementId: string | null;
  carouselTitle: string;
  savedCarouselId: string | null;
  templates: Template[];
  /** Global grain intensity for all slides: 0 = off, 100 = max */
  grainIntensity: number;

  setTitle: (title: string) => void;
  setSavedId: (id: string | null) => void;
  setGrainIntensity: (v: number) => void;
  addSlide: () => void;
  removeSlide: (id: string) => void;
  duplicateSlide: (id: string) => void;
  selectSlide: (id: string) => void;
  updateSlide: (id: string, update: Partial<Slide>) => void;
  selectElement: (id: string | null) => void;
  addElement: (slideId: string, type: TextElement["type"]) => void;
  updateElement: (slideId: string, elementId: string, update: Partial<TextElement>) => void;
  removeElement: (slideId: string, elementId: string) => void;
  loadTemplate: (templateId: string) => void;
  loadCarousel: (id: string, title: string, slides: Slide[]) => void;
  newCarousel: () => void;
  reorderSlides: (from: number, to: number) => void;
};

export const useCanvasStore = create<CanvasStore>((set, get) => {
  const defaultSlide = makeDefaultSlide();
  return {
    slides: [defaultSlide],
    selectedSlideId: defaultSlide.id,
    selectedElementId: null,
    carouselTitle: "Neues Karussell",
    savedCarouselId: null,
    templates: TEMPLATES,
    grainIntensity: 30,

    setTitle: (title) => set({ carouselTitle: title }),
    setGrainIntensity: (v) => set({ grainIntensity: Math.max(0, Math.min(100, v)) }),
    setSavedId: (id) => set({ savedCarouselId: id }),

    addSlide: () => {
      const slide = makeDefaultSlide();
      set((s) => ({ slides: [...s.slides, slide], selectedSlideId: slide.id }));
    },

    removeSlide: (id) =>
      set((s) => {
        if (s.slides.length <= 1) return s;
        const slides = s.slides.filter((sl) => sl.id !== id);
        return {
          slides,
          selectedSlideId: s.selectedSlideId === id ? (slides[0]?.id ?? null) : s.selectedSlideId,
        };
      }),

    duplicateSlide: (id) =>
      set((s) => {
        const src = s.slides.find((sl) => sl.id === id);
        if (!src) return s;
        const copy: Slide = {
          ...src,
          id: nanoid(),
          elements: src.elements.map((el) => ({ ...el, id: nanoid() })),
        };
        const idx = s.slides.findIndex((sl) => sl.id === id);
        const slides = [...s.slides];
        slides.splice(idx + 1, 0, copy);
        return { slides, selectedSlideId: copy.id };
      }),

    selectSlide: (id) => set({ selectedSlideId: id, selectedElementId: null }),

    updateSlide: (id, update) =>
      set((s) => ({
        slides: s.slides.map((sl) => (sl.id === id ? { ...sl, ...update } : sl)),
      })),

    selectElement: (id) => set({ selectedElementId: id }),

    addElement: (slideId, type) => {
      const yByType: Record<TextElement["type"], number> = {
        header: 35, subtitle: 55, body: 70, tag: 15,
      };
      const defaults: Record<TextElement["type"], Partial<TextElement>> = {
        header:   { fontSize: 30, fontWeight: "extrabold", fontFamily: "Playfair Display", color: "#ffffff" },
        subtitle: { fontSize: 16, fontWeight: "normal",    fontFamily: "Inter",            color: "rgba(255,255,255,0.6)" },
        body:     { fontSize: 13, fontWeight: "normal",    fontFamily: "Inter",            color: "rgba(255,255,255,0.45)" },
        tag:      { fontSize: 11, fontWeight: "semibold",  fontFamily: "Montserrat",       color: "#60a5fa" },
      };
      const el: TextElement = {
        id: nanoid(),
        type,
        text: type === "tag" ? "LABEL" : type === "header" ? "Titel" : type === "subtitle" ? "Subtitel" : "Text",
        align: "center",
        x: 50,
        y: yByType[type],
        fontSize: 16,
        fontWeight: "normal",
        fontFamily: "Inter",
        color: "#ffffff",
        ...defaults[type],
      };
      set((s) => ({
        slides: s.slides.map((sl) =>
          sl.id === slideId ? { ...sl, elements: [...sl.elements, el] } : sl
        ),
        selectedElementId: el.id,
      }));
    },

    updateElement: (slideId, elementId, update) =>
      set((s) => ({
        slides: s.slides.map((sl) =>
          sl.id === slideId
            ? {
                ...sl,
                elements: sl.elements.map((el) =>
                  el.id === elementId ? { ...el, ...update } : el
                ),
              }
            : sl
        ),
      })),

    removeElement: (slideId, elementId) =>
      set((s) => ({
        slides: s.slides.map((sl) =>
          sl.id === slideId
            ? { ...sl, elements: sl.elements.filter((el) => el.id !== elementId) }
            : sl
        ),
        selectedElementId: s.selectedElementId === elementId ? null : s.selectedElementId,
      })),

    loadTemplate: (templateId) => {
      const tpl = TEMPLATES.find((t) => t.id === templateId);
      if (!tpl) return;
      const slides = tpl.slides.map((sl) => ({
        ...sl,
        id: nanoid(),
        elements: sl.elements.map((el) => ({ ...el, id: nanoid() })),
      }));
      set({ slides, selectedSlideId: slides[0]?.id ?? null, selectedElementId: null, savedCarouselId: null });
    },

    loadCarousel: (id, title, rawSlides) => {
      const slides = rawSlides.map((sl) => ({
        ...sl,
        id: nanoid(),
        elements: sl.elements.map((el) => ({ ...el, id: nanoid() })),
      }));
      set({
        slides,
        selectedSlideId: slides[0]?.id ?? null,
        selectedElementId: null,
        carouselTitle: title,
        savedCarouselId: id,
      });
    },

    newCarousel: () => {
      const slide = makeDefaultSlide();
      set({
        slides: [slide],
        selectedSlideId: slide.id,
        selectedElementId: null,
        carouselTitle: "Neues Karussell",
        savedCarouselId: null,
      });
    },

    reorderSlides: (from, to) =>
      set((s) => {
        const slides = [...s.slides];
        const [moved] = slides.splice(from, 1);
        slides.splice(to, 0, moved);
        return { slides };
      }),
  };
});
