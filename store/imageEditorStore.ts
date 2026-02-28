import { create } from "zustand";

export type ImageStatus = "idle" | "processing" | "done" | "error";

export type EditorImage = {
  id: string;
  dbId?: string;
  sessionId?: string;
  file?: File;
  originalDataUrl: string;
  originalBase64: string;
  mimeType: string;
  resultDataUrl?: string;
  resultBase64?: string;
  resultMimeType?: string;
  prompt: string;
  status: ImageStatus;
  error?: string;
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

export const useImageEditorStore = create<ImageEditorStore>((set) => ({
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
}));
