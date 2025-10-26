import React, { useEffect, useRef, useState } from "react";

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
      className={`
        absolute  /* <- viewport-relative because parent is fixed */
        z-[2147483647]
        w-[380px] max-h-[60vh]
        bg-zinc-900 text-white rounded-xl border border-zinc-700
        shadow-2xl flex flex-col overflow-hidden font-sans
        text-[13px] leading-[1.5] select-none
      `}
      style={{
        ...dynamicStyle,
        cursor: drag ? "grabbing" : "default",
      }}
    >
      {/* HEADER */}
      <div
        onMouseDown={startDrag}
        className={`
          bg-zinc-800 border-b border-zinc-700 
          flex items-center justify-between px-3 py-3
          ${drag ? "cursor-grabbing" : "cursor-grab"}
        `}
      >
        {/* Title + subtitle */}
        <div className="flex flex-col leading-tight">
          <div className="text-[13px] font-semibold text-white">
            Learning Buddy
          </div>
          <div className="text-[11px] text-zinc-400">AI explanation panel</div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            className={`
              px-2.5 py-1 text-[12px] font-medium rounded-md
              bg-zinc-700 border border-zinc-600
              hover:bg-zinc-600 transition-colors
            `}
            onClick={() => {
              onAdd(content, explanation);
            }}
          >
            Add
          </button>

          <button
            className={`
              px-2.5 py-1 text-[12px] font-medium rounded-md
              bg-zinc-700 border border-zinc-600
              hover:bg-zinc-600 transition-colors
            `}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>

      {/* content */}
      <div className="px-3 pt-3 pb-1 text-[13px] font-semibold text-white leading-snug">
        {content}
      </div>

      {/* Body */}
      <div
        className={`
          px-3 pb-3 text-[13px] text-zinc-200
          whitespace-pre-wrap overflow-y-auto flex-1
        `}
      >
        {explanation}
      </div>
    </div>
  );
};
