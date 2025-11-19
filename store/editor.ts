import { create } from "zustand";
import type { PosterId } from "../types/poster";

type SelectedPanel = "canvas" | "ai" | "settings" | "export";

interface EditorState {
  // Which poster is currently open (null = new/unsaved)
  posterId: PosterId | null;
  posterTitle: string;
  backgroundUrl: string | null;

  // Last prompt used for background generation (for re-use)
  backgroundPrompt: string;

  // UI state
  selectedPanel: SelectedPanel;
  isDiffusionLoading: boolean;
  hasUnsavedChanges: boolean;

  // Actions
  setPosterId: (id: PosterId | null) => void;
  setPosterTitle: (title: string) => void;
  setBackgroundUrl: (url: string | null) => void;
  setBackgroundPrompt: (prompt: string) => void;
  setSelectedPanel: (panel: SelectedPanel) => void;
  setDiffusionLoading: (loading: boolean) => void;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  resetEditor: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  posterId: null,
  posterTitle: "Untitled poster",
  backgroundUrl: null,
  backgroundPrompt: "",
  selectedPanel: "canvas",
  isDiffusionLoading: false,
  hasUnsavedChanges: false,

  setPosterId: (posterId) => set({ posterId }),
  setPosterTitle: (posterTitle) => set({ posterTitle }),
  setBackgroundUrl: (backgroundUrl) => set({ backgroundUrl }),
  setBackgroundPrompt: (backgroundPrompt) => set({ backgroundPrompt }),
  setSelectedPanel: (selectedPanel) => set({ selectedPanel }),
  setDiffusionLoading: (isDiffusionLoading) => set({ isDiffusionLoading }),
  setHasUnsavedChanges: (hasUnsavedChanges) => set({ hasUnsavedChanges }),

  resetEditor: () =>
    set({
      posterId: null,
      posterTitle: "Untitled poster",
      backgroundUrl: null,
      backgroundPrompt: "",
      selectedPanel: "canvas",
      isDiffusionLoading: false,
      hasUnsavedChanges: false,
    }),
}));