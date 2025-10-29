import React, { useEffect, useRef, useState } from "react";
import "./Panel.css";

export type PanelProps = {
  onClose: () => void;
  onAdd: (content: string, explanation: string) => void;
  nearRect?: DOMRect | null;
  initialContent: string;
  initialExplanation: string;
  contentStream?: AsyncIterable<string>;
  explanationStream?: AsyncIterable<string>;
};

export const Panel: React.FC<PanelProps> = ({
  onClose,
  onAdd,
  nearRect,
  initialContent,
  initialExplanation,
  contentStream,
  explanationStream,
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
      let top = nearRect.bottom + 10;
      let left = nearRect.left;

      // try above if bottom would overflow
      if (top + panelH + pad > window.innerHeight) {
        top = nearRect.top - panelH - 10;
      }

      // clamp vertical
      if (top < pad) top = pad;
      if (top + panelH + pad > window.innerHeight) {
        top = window.innerHeight - panelH - pad;
      }

      // clamp horizontal
      if (left + panelW + pad > window.innerWidth) {
        left = window.innerWidth - panelW - pad;
      }
      if (left < pad) left = pad;

      setPos({ top, left });
    } else {
      const pad = 8;
      const panelH = Math.min(window.innerHeight * 0.6, 400);
      const panelW = 380;
      const top = Math.max(pad, (window.innerHeight - panelH) / 2);
      const left = Math.max(pad, (window.innerWidth - panelW) / 2);
      setPos({ top, left });
    }
  }, [nearRect]);

  // --- Dragging logic in VIEWPORT space, with CLAMP ---
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!drag) return;
      if (!ref.current) return;

      const pad = 8;

      // panel size right now (in case it responsive-changes)
      const { offsetWidth: panelW, offsetHeight: panelH } = ref.current;

      // raw new pos
      let newTop = drag.origTop + (e.clientY - drag.startY);
      let newLeft = drag.origLeft + (e.clientX - drag.startX);

      // clamp vertically
      const maxTop = window.innerHeight - panelH - pad;
      if (newTop < pad) newTop = pad;
      if (newTop > maxTop) newTop = Math.max(pad, maxTop); // maxTop can go negative if panel > viewport

      // clamp horizontally
      const maxLeft = window.innerWidth - panelW - pad;
      if (newLeft < pad) newLeft = pad;
      if (newLeft > maxLeft) newLeft = Math.max(pad, maxLeft);

      setPos({
        top: newTop,
        left: newLeft,
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

  // --- contentStream handling ---
  useEffect(() => {
    if (!contentStream) {
      setCurrentContent(initialContent);
      return;
    }
    let isActive = true;
    setCurrentContent("");

    const processStream = async () => {
      try {
        for await (const chunk of contentStream) {
          if (!isActive) break;
          setCurrentContent((prev) => prev + chunk);
        }
        if (isActive) {
          setCurrentContent((prev) => prev || "Summary");
        }
      } catch (error) {
        if (isActive) setCurrentContent("Error summarizing.");
        console.error("Error processing content stream:", error);
      }
    };
    processStream();
    return () => {
      isActive = false;
    };
  }, [contentStream, initialContent]);

  useEffect(() => {
  function onResize() {
    if (!ref.current || !pos) return;
    const pad = 8;
    const panelW = ref.current.offsetWidth;
    const panelH = ref.current.offsetHeight;

    let newTop = pos.top;
    let newLeft = pos.left;

    const maxTop = window.innerHeight - panelH - pad;
    const maxLeft = window.innerWidth - panelW - pad;

    if (newTop > maxTop) newTop = Math.max(pad, maxTop);
    if (newLeft > maxLeft) newLeft = Math.max(pad, maxLeft);

    if (newTop < pad) newTop = pad;
    if (newLeft < pad) newLeft = pad;

    setPos({ top: newTop, left: newLeft });
  }

  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}, [pos]);

  // --- explanationStream handling ---
  useEffect(() => {
    if (!explanationStream) {
      setCurrentExplanation(initialExplanation);
      return;
    }
    let isActive = true;
    setCurrentExplanation("");

    const processStream = async () => {
      try {
        for await (const chunk of explanationStream) {
          if (!isActive) break;
          setCurrentExplanation((prev) => prev + chunk);
        }
        if (isActive) {
          setCurrentExplanation((prev) => prev || "No output.");
        }
      } catch (error) {
        if (isActive) setCurrentExplanation("Error generating explanation.");
        console.error("Error processing explanation stream:", error);
      }
    };
    processStream();
    return () => {
      isActive = false;
    };
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
          <button onClick={() => onAdd(currentContent, currentExplanation)}>
            Add
          </button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>

      {/* Summary */}
      <div id="lb-panel-content-heading">{currentContent}</div>

      {/* Body */}
      <div id="lb-panel-body">{currentExplanation}</div>
    </div>
  );
};
