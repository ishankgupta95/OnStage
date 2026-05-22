import { create } from "zustand";
import { temporal } from "zundo";
import type { ScreenshotConfig } from "@/lib/schema";

type EditorState = {
  config: ScreenshotConfig | null;
  selectedLayerId: string | null;
  setConfig: (config: ScreenshotConfig) => void;
  patchConfig: (partial: Partial<ScreenshotConfig>) => void;
  selectLayer: (id: string | null) => void;
};

export const useEditorStore = create<EditorState>()(
  temporal(
    (set) => ({
      config: null,
      selectedLayerId: null,
      setConfig: (config) => set({ config }),
      patchConfig: (partial) =>
        set((state) =>
          state.config ? { config: { ...state.config, ...partial } } : state,
        ),
      selectLayer: (selectedLayerId) => set({ selectedLayerId }),
    }),
    {
      // Undo/redo tracks the document only — not transient UI like layer selection.
      partialize: (state) => ({ config: state.config }),
      limit: 50,
    },
  ),
);

// Usage: useEditorStore.temporal.getState().undo() / .redo()
