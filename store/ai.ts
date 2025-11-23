import { create } from "zustand";
import type { PosterOp } from "../types/poster";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  error?: boolean;
}

interface AiState {
  // What the user has typed in the AI prompt box
  instruction: string;

  // Whether a request to the backend/LLM is in flight
  isThinking: boolean;

  // Chat history
  messages: ChatMessage[];

  // Bookkeeping
  lastInstruction: string | null;
  lastError: string | null;
  lastOperations: PosterOp[] | null;

  // Actions
  setInstruction: (value: string) => void;
  startThinking: () => void;
  finishThinking: () => void;
  setError: (message: string | null) => void;
  setLastResult: (instruction: string, ops: PosterOp[]) => void;
  resetAiState: () => void;
  addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => void;
  clearMessages: () => void;
}

export const useAiStore = create<AiState>((set) => ({
  instruction: "",
  isThinking: false,
  messages: [],
  lastInstruction: null,
  lastError: null,
  lastOperations: null,

  setInstruction: (instruction) => set({ instruction }),

  startThinking: () =>
    set({
      isThinking: true,
      lastError: null,
    }),

  finishThinking: () => set({ isThinking: false }),

  setError: (lastError) =>
    set({
      lastError,
      isThinking: false,
    }),

  setLastResult: (lastInstruction, lastOperations) =>
    set({
      lastInstruction,
      lastOperations,
      isThinking: false,
      lastError: null,
      instruction: "", // clear input after success
    }),

  resetAiState: () =>
    set({
      instruction: "",
      isThinking: false,
      lastInstruction: null,
      lastError: null,
      lastOperations: null,
      messages: [],
    }),

  addMessage: (message) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id: `${Date.now()}-${Math.random()}`,
          timestamp: new Date(),
        },
      ],
    })),

  clearMessages: () => set({ messages: [] }),
}));