import React, { useEffect, useRef, useState } from "react";

type PanelProps = {
  content: string;
  onClose: () => void;
  nearRect?: DOMRect | null;
};

export const Panel: React.FC<PanelProps> = ({ content, onClose, nearRect }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [drag, setDrag] = useState<{
    startX: number;
    startY: number;
    origTop: number;
    origLeft: number;
  } | null>(null);

  // Initial positioning (center or near selection)
  useEffect(() => {
    const panelW = 380;
    const panelH = Math.min(window.innerHeight * 0.6, 400);

    if (nearRect) {
      const pad = 8;
      const top = Math.max(
        pad,
        Math.min(window.innerHeight - panelH - pad, nearRect.bottom + 10)
      );
      const left = Math.max(
        pad,
        Math.min(window.innerWidth - panelW - pad, nearRect.left)
      );
      setPos({ top, left });
    } else {
      // fallback: center
      const top = (window.innerHeight - panelH) / 2;
      const left = (window.innerWidth - panelW) / 2;
      setPos({ top, left });
    }
  }, [nearRect]);

  // Handle dragging
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

  const styleTop = pos ? `${pos.top}px` : "50%";
  const styleLeft = pos ? `${pos.left}px` : "50%";
  const styleTransform = pos ? "none" : "translate(-50%, -50%)";

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        zIndex: 2147483647,
        width: 380,
        maxHeight: "60vh",
        background: "#111",
        color: "#fff",
        borderRadius: 12,
        border: "1px solid #333",
        boxShadow: "0 12px 32px rgba(0,0,0,.35)",
        font: "13px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        top: styleTop,
        left: styleLeft,
        transform: styleTransform,
        cursor: drag ? "grabbing" : "default",
      }}
    >
      <div
        onMouseDown={startDrag}
        style={{
          userSelect: "none",
          padding: "10px 12px",
          background: "#181818",
          borderBottom: "1px solid #2a2a2a",
          fontWeight: 600,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: drag ? "grabbing" : "grab",
        }}
      >
        <div>Learning Buddy • Writer</div>
        <button
          style={{
            appearance: "none",
            background: "#262626",
            color: "#fff",
            border: "1px solid #3a3a3a",
            borderRadius: 8,
            padding: "4px 8px",
            cursor: "pointer",
          }}
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div
        style={{
          padding: 12,
          overflow: "auto",
          whiteSpace: "pre-wrap",
          flex: 1,
        }}
      >
        {content}
      </div>
    </div>
  );
};
