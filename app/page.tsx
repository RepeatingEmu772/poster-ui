"use client";
import { useState, useRef, useEffect } from "react";

import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from "@tanstack/react-query";

import { Tldraw, Editor, createShapeId, AssetRecordType } from "tldraw";
import { useAiStore } from "../store/ai";
import { useEditorStore } from "../store/editor";

function AiPanel({ editor }: { editor: Editor | null }) {
  const instruction = useAiStore((s) => s.instruction);
  const setInstruction = useAiStore((s) => s.setInstruction);
  const messages = useAiStore((s) => s.messages);
  const addMessage = useAiStore((s) => s.addMessage);
  const setBackgroundUrl = useEditorStore((s) => s.setBackgroundUrl);
  const [isThinking, setIsThinking] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const applyInstructionMutation = useMutation({
    mutationFn: async (instructionText: string) => {
      const res = await fetch("/api/poster-gen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ instruction: instructionText }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(
          `Poster generation failed (${res.status}): ${errorText || "Unknown error"}`
        );
      }

      return res.json();
    },
    onMutate: async (instructionText) => {
      setIsThinking(true);
      setLastError(null);
      
      // Add user message to chat
      addMessage({
        role: "user",
        content: instructionText,
      });
    },
    onError: (error: Error) => {
      setLastError(error.message);
      setIsThinking(false);
      
      // Add error message to chat
      addMessage({
        role: "assistant",
        content: error.message,
        error: true,
      });
    },
    onSuccess: async (data, variables) => {
      setIsThinking(false);
      setInstruction(""); // Clear input after success
      
      console.log("RunPod response:", data);
      
      // Extract image URL from RunPod response (nested under 'runpod' property)
      const imageUrl = data?.runpod?.output?.result;
      
      console.log("Extracted imageUrl:", imageUrl);
      console.log("Editor exists:", !!editor);
      
      if (imageUrl && editor) {
        try {
          // Save the URL to the store
          setBackgroundUrl(imageUrl);
          
          // Create an asset ID for the image
          const assetId = AssetRecordType.createId();
          
          // Get image dimensions
          const img = new Image();
          img.crossOrigin = "anonymous";
          
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imageUrl;
          });
          
          const imageWidth = img.width;
          const imageHeight = img.height;
          
          // Create the asset
          editor.createAssets([
            {
              id: assetId,
              type: 'image',
              typeName: 'asset',
              props: {
                name: 'generated-poster.jpeg',
                src: imageUrl,
                w: imageWidth,
                h: imageHeight,
                mimeType: 'image/jpeg',
                isAnimated: false,
              },
              meta: {},
            },
          ]);
          
          // Add the image to the canvas
          const shapeId = createShapeId();
          const viewport = editor.getViewportPageBounds();
          
          // Calculate dimensions to fit nicely on screen
          const maxWidth = viewport.width * 0.8;
          const maxHeight = viewport.height * 0.8;
          const scale = Math.min(maxWidth / imageWidth, maxHeight / imageHeight, 1);
          const finalWidth = imageWidth * scale;
          const finalHeight = imageHeight * scale;
          
          editor.createShape({
            id: shapeId,
            type: 'image',
            x: viewport.x + (viewport.width - finalWidth) / 2,
            y: viewport.y + (viewport.height - finalHeight) / 2,
            props: {
              w: finalWidth,
              h: finalHeight,
              assetId: assetId,
            },
          });
          
          // Select and zoom to the image
          editor.select(shapeId);
          editor.zoomToSelection();
          
          // Add success message to chat
          addMessage({
            role: "assistant",
            content: "Poster generated successfully! Image added to canvas.",
          });
        } catch (error) {
          console.error("Error loading image:", error);
          addMessage({
            role: "assistant",
            content: `Failed to load image: ${error instanceof Error ? error.message : 'Unknown error'}`,
            error: true,
          });
        }
      } else {
        // Add error if no image URL found
        const errorMsg = !imageUrl 
          ? `No image URL found. Response: ${JSON.stringify(data)}`
          : "Editor not ready yet";
        
        console.error("Error:", errorMsg);
        
        addMessage({
          role: "assistant",
          content: errorMsg,
          error: true,
        });
      }
    },
    onSettled: () => {
      setIsThinking(false);
    },
  });

  const handleSubmit = () => {
    if (!instruction.trim() || isThinking) return;
    applyInstructionMutation.mutate(instruction);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <aside className="ai-panel">
      <h1 className="ai-panel-title">
        Poster UI
      </h1>
      <div className="ai-panel-content">
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="chat-empty-state">
              <p>Start a conversation by describing what you want to create!</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`chat-message ${message.role === "user" ? "chat-message-user" : "chat-message-assistant"} ${message.error ? "chat-message-error" : ""}`}
              >
                <div className="chat-message-role">
                  {message.role === "user" ? "You" : "Assistant"}
                </div>
                <div className="chat-message-content">{message.content}</div>
                <div className="chat-message-time">
                  {message.timestamp.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
            ))
          )}
          {isThinking && (
            <div className="chat-message chat-message-assistant">
              <div className="chat-message-role">Assistant</div>
              <div className="chat-message-content chat-thinking">
                <span className="thinking-dot"></span>
                <span className="thinking-dot"></span>
                <span className="thinking-dot"></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="chat-input-container">
          <textarea
            className="ai-panel-textarea"
            placeholder='e.g. "Add a bold title at the top and make all text white."'
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            className="ai-panel-button"
            disabled={isThinking || !instruction.trim()}
            onClick={handleSubmit}
          >
            {isThinking ? "Generating..." : "Send"}
          </button>
        </div>
      </div>
    </aside>
  );
}

export default function Home() {
  const [queryClient] = useState(() => new QueryClient());
  const [editor, setEditor] = useState<Editor | null>(null);

  return (
    <QueryClientProvider client={queryClient}>
      <main className="main-container">
        <AiPanel editor={editor} />
        <div className="canvas-container">
          <div className="canvas-wrapper">
            <Tldraw onMount={(editor) => setEditor(editor)} />
          </div>
        </div>
      </main>
    </QueryClientProvider>
  );
}