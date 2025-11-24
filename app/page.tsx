"use client";
import { useState, useRef, useEffect } from "react";

import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from "@tanstack/react-query";

import { Tldraw, Editor, createShapeId, AssetRecordType, TLShapeId, toRichText } from "tldraw";
import { useAiStore } from "../store/ai";
import { useEditorStore } from "../store/editor";
import { getCanvasContext, extractJSONFromMarkdown, type AIResponse, type AITextElement } from "../lib/canvas-utils";

// Helper function to map font size to tldraw size
function mapFontSizeToTldrawSize(fontSize: number): 's' | 'm' | 'l' | 'xl' {
  if (fontSize <= 16) return 's';
  if (fontSize <= 24) return 'm';
  if (fontSize <= 48) return 'l';
  return 'xl';
}

// Helper function to map hex/color names to tldraw colors
function mapColorToTldraw(color: string): 'black' | 'grey' | 'light-violet' | 'violet' | 'blue' | 'light-blue' | 'yellow' | 'orange' | 'green' | 'light-green' | 'light-red' | 'red' | 'white' {
  const colorLower = color.toLowerCase().replace(/[#\s]/g, '');
  
  // Map common hex colors
  const hexMap: Record<string, any> = {
    '000000': 'black',
    '000': 'black',
    'ffffff': 'white',
    'fff': 'white',
    'ff0000': 'red',
    'f00': 'red',
    'ff6666': 'light-red',
    '00ff00': 'green',
    '0f0': 'green',
    '66ff66': 'light-green',
    '0000ff': 'blue',
    '00f': 'blue',
    '6666ff': 'light-blue',
    'ffff00': 'yellow',
    'ff0': 'yellow',
    'ffa500': 'orange',
    '808080': 'grey',
    'gray': 'grey',
    'grey': 'grey',
    '8b00ff': 'violet',
    'bb88ff': 'light-violet',
  };
  
  // Check hex map
  if (hexMap[colorLower]) {
    return hexMap[colorLower];
  }
  
  // Map color names
  if (colorLower.includes('white')) return 'white';
  if (colorLower.includes('black')) return 'black';
  if (colorLower.includes('red')) return colorLower.includes('light') ? 'light-red' : 'red';
  if (colorLower.includes('green')) return colorLower.includes('light') ? 'light-green' : 'green';
  if (colorLower.includes('blue')) return colorLower.includes('light') ? 'light-blue' : 'blue';
  if (colorLower.includes('violet') || colorLower.includes('purple')) return colorLower.includes('light') ? 'light-violet' : 'violet';
  if (colorLower.includes('yellow')) return 'yellow';
  if (colorLower.includes('orange')) return 'orange';
  if (colorLower.includes('grey') || colorLower.includes('gray')) return 'grey';
  
  // Default to white for unknown colors
  return 'white';
}

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
      // Get current canvas context
      const canvasContext = editor ? getCanvasContext(editor) : null;
      
      const res = await fetch("/api/poster-gen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          instruction: instructionText,
          canvasContext: canvasContext,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(
          `Poster generation failed (${res.status}): ${errorText || "Unknown error"}`
        );
      }

      return res.json() as Promise<AIResponse>;
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
      
      if (!editor) {
        addMessage({
          role: "assistant",
          content: "Editor not ready yet",
          error: true,
        });
        return;
      }

      try {
        // Check if AI returned a new image to generate
        // Try both old format (runpod.output.result) and new format (output.result)
        const imageUrl = data?.output?.result || data?.runpod?.output?.result;
        
        console.log("Extracted imageUrl:", imageUrl);
        
        // Parse elements from the response
        let elements = data?.elements || data?.output?.elements;
        let reasoning = data?.reasoning || data?.output?.reasoning;
        
        // If elements are empty but raw exists, try to parse from markdown
        if ((!elements || elements.length === 0) && data?.output?.raw) {
          console.log("Parsing elements from raw markdown...");
          const parsed = extractJSONFromMarkdown(data.output.raw);
          if (parsed) {
            elements = parsed.elements;
            reasoning = parsed.reasoning || reasoning;
            console.log("Parsed elements:", elements);
          }
        }
        
        if (imageUrl) {
          // This is a new image generation (first request)
          setBackgroundUrl(imageUrl);
          
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
          
          editor.select(shapeId);
          editor.zoomToSelection();
          
          addMessage({
            role: "assistant",
            content: "Poster generated successfully! Image added to canvas.",
          });
        }
        
        // Check if AI returned text/shape elements to place on canvas
        if (elements && elements.length > 0) {
          const createdShapeIds: TLShapeId[] = [];
          
          for (const element of elements) {
            if (element.type === "text") {
              const shapeId = createShapeId();
              
              // Create text shape with richText (tldraw v4 requirement)
              editor.createShape({
                id: shapeId,
                type: 'text',
                x: element.position.x,
                y: element.position.y,
                props: {
                  richText: toRichText(element.content),
                  size: element.style.fontSize ? mapFontSizeToTldrawSize(element.style.fontSize) : 'm',
                  color: mapColorToTldraw(element.style.color || 'black'),
                  font: element.style.fontFamily === 'serif' ? 'serif' : 
                        element.style.fontFamily === 'mono' ? 'mono' : 'sans',
                  w: element.bounds?.width || 200,
                  autoSize: !element.bounds?.width, // Auto-size if no width specified
                  scale: 1,
                  textAlign: 'start',
                },
              });
              
              createdShapeIds.push(shapeId);
            }
          }
          
          if (createdShapeIds.length > 0) {
            editor.select(...createdShapeIds);
            
            addMessage({
              role: "assistant",
              content: `Added ${createdShapeIds.length} element(s) to canvas. ${reasoning || ""}`,
            });
          }
        } else if (!imageUrl) {
          // No image and no elements returned
          addMessage({
            role: "assistant",
            content: `Response received but no elements to add. ${reasoning || data?.output?.raw || ""}`,
            error: true,
          });
        }
      } catch (error) {
        console.error("Error processing AI response:", error);
        addMessage({
          role: "assistant",
          content: `Failed to process response: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
            placeholder='What do u want to create a poster of? or "Describe the text you want to add to the poster."'
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