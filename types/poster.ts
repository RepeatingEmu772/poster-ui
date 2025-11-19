export type PosterId = string;

// Operation that the LLM can return to modify the poster.
// Keep it small for now – we can expand later.
export type PosterOp =
  | {
      op: "add_text";
      text: string;
      x: number;
      y: number;
      fontSize?: number;
      color?: string;
    }
  | {
      op: "update_all_text_color";
      color: string;
    }
  | {
      op: "add_rect";
      x: number;
      y: number;
      width: number;
      height: number;
      color?: string;
    };

// Later this can be the actual tldraw snapshot type,
// but for now just treat it as unknown JSON.
export type CanvasSnapshot = unknown;

// Poster metadata
export interface Poster {
  id: PosterId;
  title: string;
  backgroundUrl: string | null;
  // Serialized tldraw document (what you'll save to Postgres)
  document: CanvasSnapshot | null;
  meta?: {
    size?: "A4" | "A3" | "Story" | "Square";
    theme?: string;
  };
}