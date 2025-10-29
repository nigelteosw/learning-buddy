import React, { useEffect, useRef, useState } from "react";
import './Panel.css';

export type PanelProps = {
  onClose: () => void;
  onAdd: (content: string, explanation: string) => void; // Pass final state back
  nearRect?: DOMRect | null;
  initialContent: string; // Starting value before stream
  initialExplanation: string; // Starting value before stream
  contentStream?: AsyncIterable<string>;      // Optional: Stream for summary
  explanationStream?: AsyncIterable<string>; // Optional: Stream for writer
};

export const Panel: React.FC<PanelProps> = ({
  onClose,
  onAdd,
  nearRect,
  initialContent,
  initialExplanation,
  contentStream,      // Get the stream props
  explanationStream,  // Get the stream props
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [drag, setDrag] = useState<{
    startX: number;
    startY: number;
    origTop: number;
    origLeft: number;
  } | null>(null);

  const [currentContent, setCurrentContent] = useState(initialContent);
  const [currentExplanation, setCurrentExplanation] = useState(initialExplanation);

  // --- Initial positioning in VIEWPORT space ---
  useEffect(() => {
    const panelW = 380;
    const panelH = Math.min(window.innerHeight * 0.6, 400);
    const pad = 8;

    if (nearRect) {
      // nearRect is in viewport coordinates (getBoundingClientRect)
      // so we also stay in viewport coordinates

      // try below selection first
      let top = nearRect.bottom + 10;
      let left = nearRect.left;

      // clamp vertically (avoid going off bottom)
      if (top + panelH + pad > window.innerHeight) {
        // try above instead
        top = nearRect.top - panelH - 10;
      }
      // clamp if still off-screen
      if (top < pad) {
        top = pad;
      }
      if (top + panelH + pad > window.innerHeight) {
        top = window.innerHeight - panelH - pad;
      }

      // clamp horizontally
      if (left + panelW + pad > window.innerWidth) {
        left = window.innerWidth - panelW - pad;
      }
      if (left < pad) {
        left = pad;
      }

      setPos({ top, left });
    } else {
      // fallback: center in viewport
      const top = Math.max(pad, (window.innerHeight - panelH) / 2);
      const left = Math.max(pad, (window.innerWidth - panelW) / 2);
      setPos({ top, left });
    }
  }, [nearRect]);

  // --- Dragging logic in VIEWPORT space ---
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!drag) return;
      setPos({
        top: drag.origTop + (e.clientY - drag.startY),
        left: drag.origLeft + (e.clientX - drag.startX),
      });
    }

    function onMouseUp() {
      setDrag(null);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [drag]);

  const startDrag = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setDrag({
      startX: e.clientX,
      startY: e.clientY,
      origTop: rect.top,
      origLeft: rect.left,
    });
  };

  // styles for inline dynamic placement
  const dynamicStyle = pos
    ? {
        top: `${pos.top}px`,
        left: `${pos.left}px`,
        transform: "none",
      }
    : {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };

  // --- 3. Add useEffect Hooks to consume streams ---
  useEffect(() => {
    if (!contentStream) {
      // If no stream is provided, ensure state reflects initial prop
      setCurrentContent(initialContent);
      return;
    }
    let isActive = true;
    setCurrentContent(''); // Reset for stream

    const processStream = async () => {
      try {
        for await (const chunk of contentStream) {
          if (!isActive) break;
          setCurrentContent(prev => prev + chunk);
        }
        // Set default if stream finishes empty
        if (isActive) {
           setCurrentContent(prev => prev || 'Summary');
        }
      } catch (error) {
         if (isActive) setCurrentContent('Error summarizing.');
         console.error("Error processing content stream:", error);
      }
    };
    processStream();
    return () => { isActive = false; };
  }, [contentStream, initialContent]); // Re-run if stream or initial value changes

  useEffect(() => {
    if (!explanationStream) {
      // If no stream is provided, ensure state reflects initial prop
      setCurrentExplanation(initialExplanation);
      return;
    }
    let isActive = true;
    setCurrentExplanation(''); // Reset for stream

    const processStream = async () => {
      try {
        for await (const chunk of explanationStream) {
          if (!isActive) break;
          setCurrentExplanation(prev => prev + chunk);
        }
        // Set default if stream finishes empty
        if (isActive) {
           setCurrentExplanation(prev => prev || 'No output.');
        }
      } catch (error) {
         if (isActive) setCurrentExplanation('Error generating explanation.');
         console.error("Error processing explanation stream:", error);
      }
    };
    processStream();
    return () => { isActive = false; };
  }, [explanationStream, initialExplanation]);

  return (
    <div
      ref={ref}
      id="lb-panel"
      style={{
        ...dynamicStyle,
        cursor: drag ? "grabbing" : "default",
      }}
    >
      {/* HEADER */}
      <div
        onMouseDown={startDrag}
        id="lb-panel-header"
        style={{
          cursor: drag ? "grabbing" : "grab",
        }}
      >
        {/* Title */}
        <div id="lb-panel-header-title">
          <div id="lb-panel-header-title-main">Learning Buddy</div>
          <div id="lb-panel-header-title-sub">AI explanation panel</div>
        </div>

        {/* Actions */}
        <div id="lb-panel-header-actions">
          {/* 5. Update onAdd call */}
          <button
            onClick={() => onAdd(currentContent, currentExplanation)} // Pass current state
          >
            Add
          </button>
          <button onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {/* content */}
      {/* 4. Render State */}
      <div id="lb-panel-content-heading">
        {currentContent}
      </div>

      {/* Body */}
      {/* 4. Render State */}
      <div id="lb-panel-body">
        {currentExplanation}
      </div>
    </div>
  );
};
