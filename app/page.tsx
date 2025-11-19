"use client";

import { Tldraw } from "tldraw";
import { useAiStore } from "../store/ai";

function AiPanel() {
  const instruction = useAiStore((s) => s.instruction);
  const setInstruction = useAiStore((s) => s.setInstruction);
  const isThinking = useAiStore((s) => s.isThinking);
  const lastError = useAiStore((s) => s.lastError);
  const lastInstruction = useAiStore((s) => s.lastInstruction);

  const handleSubmit = () => {
    if (!instruction.trim() || isThinking) return;
    // For now this is just a placeholder.
    // Later you'll call your FastAPI /ai/apply-instruction endpoint from here
    // or trigger a React Query mutation.
    console.log("AI instruction submitted:", instruction);
  };

  return (
    <aside className="ai-panel">
      <h1 className="ai-panel-title">
        AI Poster Assistant
      </h1>
      <p className="ai-panel-description">
        Describe how you want the poster to change. Later this will talk to your
        FastAPI + LLM backend.
      </p>
      <textarea
        className="ai-panel-textarea"
        placeholder='e.g. "Add a bold title at the top and make all text white."'
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
      />
      <button
        className="ai-panel-button"
        disabled={isThinking || !instruction.trim()}
        onClick={handleSubmit}
      >
        {isThinking ? "Thinking..." : "Apply with AI"}
      </button>

      {lastError && (
        <p className="ai-panel-error">Error: {lastError}</p>
      )}

      {lastInstruction && (
        <p className="ai-panel-last-instruction">
          Last instruction: <span className="italic">{lastInstruction}</span>
        </p>
      )}

      <div className="ai-panel-footer">
        Panel is UI-only for now. Next step: wire this to your FastAPI{" "}
        <code className="ai-panel-code">/ai/apply-instruction</code>{" "}
        endpoint.
      </div>
    </aside>
  );
}

export default function Home() {
  return (
    <main className="main-container">
      <AiPanel />
      <div className="canvas-container">
        <div className="canvas-wrapper">
          <Tldraw />
        </div>
      </div>
    </main>
  );
}