import React, { useEffect, useRef, useState } from "react";
import './Panel.css';

export type PanelProps = {
  content: string;
  explanation: string;
  onClose: () => void;
  onAdd: (content: string, explanation: string) => void;
  nearRect?: DOMRect | null;
};

export const Panel: React.FC<PanelProps> = ({
  content,
  explanation,
  onClose,
  onAdd,
  nearRect,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [drag, setDrag] = useState<{
    startX: number;
    startY: number;
    origTop: number;
    origLeft: number;
  } | null>(null);

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

  return (
    <div
      ref={ref}
      // 3. APPLY the main ID
      id="lb-panel"
      style={{
        ...dynamicStyle,
        cursor: drag ? "grabbing" : "default",
      }}
    >
      {/* HEADER */}
      <div
        onMouseDown={startDrag}
        // 4. APPLY header ID and handle cursor dynamically
        id="lb-panel-header"
        style={{
          cursor: drag ? "grabbing" : "grab",
        }}
      >
        {/* Title + subtitle */}
        {/* 5. APPLY nested element IDs */}
        <div id="lb-panel-header-title">
          <div id="lb-panel-header-title-main">
            Learning Buddy
          </div>
          <div id="lb-panel-header-title-sub">AI explanation panel</div>
        </div>

        {/* Actions */}
        <div id="lb-panel-header-actions">
          <button
            onClick={() => {
              onAdd(content, explanation);
            }}
          >
            Add
          </button>

          <button onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {/* content */}
      {/* 6. APPLY content heading ID */}
      <div id="lb-panel-content-heading">
        {content}
      </div>

      {/* Body */}
      {/* 7. APPLY body ID */}
      <div id="lb-panel-body">
        {explanation}
      </div>
    </div>
  );
};
