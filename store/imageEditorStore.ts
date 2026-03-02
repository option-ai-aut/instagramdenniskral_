import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ImageStatus = "idle" | "processing" | "done" | "error";

export type EditorImage = {
  id: string;
  dbId?: string;
  sessionId?: string;
  file?: File;
  originalDataUrl: string;    // base64 data URL – only in memory, never persisted
  originalBase64: string;     // raw base64 – only in memory, never persisted
  originalUrl?: string;       // Supabase URL – small, can be persisted
  mimeType: string;
  resultDataUrl?: string;     // base64 data URL – only in memory, never persisted
  resultBase64?: string;      // raw base64 – only in memory, never persisted
  resultUrl?: string;         // Supabase URL – small, can be persisted
  resultMimeType?: string;
  prompt: string;
  aiDerivedPrompt?: boolean;
  status: ImageStatus;
  error?: string;
};

/**
 * Safe localStorage wrapper – silently ignores QuotaExceededError and other
 * storage errors so the app never crashes due to a full localStorage.
 */
const safeLocalStorage = {
  getItem: (key: string) => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  setItem: (key: string, value: string) => {
    try { localStorage.setItem(key, value); } catch { /* quota exceeded – ignore */ }
  },
  removeItem: (key: string) => {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
};

type ImageEditorStore = {
  sessionId: string | null;
  images: EditorImage[];
  selectedId: string | null;
  setSessionId: (id: string) => void;
  addImages: (imgs: EditorImage[]) => void;
  removeImage: (id: string) => void;
  selectImage: (id: string) => void;
  updateImage: (id: string, update: Partial<EditorImage>) => void;
  setPrompt: (id: string, prompt: string) => void;
  useResultAsBase: (id: string) => void;
  clearAll: () => void;
};

export const useImageEditorStore = create<ImageEditorStore>()(
  persist(
    (set) => ({
  sessionId: null,
  images: [],
  selectedId: null,

  setSessionId: (id) => set({ sessionId: id }),

  addImages: (imgs) =>
    set((state) => {
      const existing = state.images.length;
      const toAdd = imgs.slice(0, 20 - existing);
      const newImages = [...state.images, ...toAdd];
      return {
        images: newImages,
        selectedId: state.selectedId ?? toAdd[0]?.id ?? null,
      };
    }),

  removeImage: (id) =>
    set((state) => {
      const images = state.images.filter((img) => img.id !== id);
      const selectedId =
        state.selectedId === id ? (images[0]?.id ?? null) : state.selectedId;
      return { images, selectedId };
    }),

  selectImage: (id) => set({ selectedId: id }),

  updateImage: (id, update) =>
    set((state) => ({
      images: state.images.map((img) =>
        img.id === id ? { ...img, ...update } : img
      ),
    })),

  setPrompt: (id, prompt) =>
    set((state) => ({
      images: state.images.map((img) =>
        img.id === id ? { ...img, prompt } : img
      ),
    })),

  useResultAsBase: (id) =>
    set((state) => ({
      images: state.images.map((img) => {
        if (img.id !== id || !img.resultDataUrl || !img.resultBase64) return img;
        return {
          ...img,
          originalDataUrl: img.resultDataUrl,
          originalBase64: img.resultBase64,
          mimeType: img.resultMimeType ?? img.mimeType,
          resultDataUrl: undefined,
          resultBase64: undefined,
          resultMimeType: undefined,
          status: "idle" as const,
          prompt: "",
        };
      }),
    })),

  clearAll: () => set({ images: [], selectedId: null, sessionId: null }),
}),
    {
      name: "image-editor-store-v2",   // bumped to invalidate old oversized cache
      storage: createJSONStorage(() => safeLocalStorage),
      // ── Only persist small fields – NEVER base64 or data: URLs ──────────
      // Base64 strings are 3-8 MB per image and quickly exceed localStorage's
      // 5 MB limit. SPA navigation preserves in-memory state anyway; localStorage
      // is only needed to survive a full page refresh, where images can't be
      // reconstructed from base64 regardless.
      partialize: (state) => ({
        sessionId:  state.sessionId,
        selectedId: state.selectedId,
        images: state.images.map((img) => ({
          id:              img.id,
          dbId:            img.dbId,
          sessionId:       img.sessionId,
          originalUrl:     img.originalUrl,   // Supabase URL – tiny string
          resultUrl:       img.resultUrl,     // Supabase URL – tiny string
          mimeType:        img.mimeType,
          resultMimeType:  img.resultMimeType,
          prompt:          img.prompt,
          aiDerivedPrompt: img.aiDerivedPrompt,
          // Reset processing state on restore; base64 not restored → idle
          status: (img.status === "processing" || !img.originalUrl)
            ? "idle"
            : img.status,
          error: img.error,
          // file, originalDataUrl, originalBase64, resultDataUrl, resultBase64
          // are intentionally excluded – too large for localStorage
        })),
      }),
    }
  )
);
