import React, { useEffect, useRef, useState } from "react";
import "./Panel.css";
import { marked } from "marked";

export type PanelTab = "explain" | "key" | "analogy" | "quiz";

export type PanelProps = {
  onClose: () => void;
  onAdd: (front: string, back: string) => void;
  nearRect?: DOMRect | null;

  sourceText?: string;

  // data for tabs (these are just strings now, not "initial")
  summaryText: string;
  explainText: string;
  keyIdeasText: string;
  analogyText: string;
  quizText: string;

  // loading states
  summaryLoading: boolean;
  explainLoading: boolean;
  keyIdeasLoading: boolean;
  analogyLoading: boolean;
  quizLoading: boolean;

  // error states
  summaryError: string | null;
  explainError: string | null;
  keyIdeasError: string | null;
  analogyError: string | null;
  quizError: string | null;

  onTabChange?: (tab: PanelTab) => void;
};

export const Panel: React.FC<PanelProps> = ({
  onClose,
  onAdd,
  nearRect,
  sourceText,

  summaryText,
  explainText,
  keyIdeasText,
  analogyText,
  quizText,

  summaryLoading,
  explainLoading,
  keyIdeasLoading,
  analogyLoading,
  quizLoading,

  summaryError,
  explainError,
  keyIdeasError,
  analogyError,
  quizError,

  onTabChange,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  // -----------------------------
  // positioning/drag (unchanged)
  // -----------------------------
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [drag, setDrag] = useState<{
    startX: number;
    startY: number;
    origTop: number;
    origLeft: number;
  } | null>(null);

  useEffect(() => {
    const panelW = 380;
    const panelH = Math.min(window.innerHeight * 0.6, 400);
    const pad = 8;

    if (nearRect) {
      let top = nearRect.bottom + 10;
      let left = nearRect.left;

      if (top + panelH + pad > window.innerHeight) {
        top = nearRect.top - panelH - 10;
      }

      if (top < pad) top = pad;
      if (top + panelH + pad > window.innerHeight) {
        top = window.innerHeight - panelH - pad;
      }

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

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!drag || !ref.current) return;

      const pad = 8;
      const { offsetWidth: panelW, offsetHeight: panelH } = ref.current;

      let newTop = drag.origTop + (e.clientY - drag.startY);
      let newLeft = drag.origLeft + (e.clientX - drag.startX);

      const maxTop = window.innerHeight - panelH - pad;
      if (newTop < pad) newTop = pad;
      if (newTop > maxTop) newTop = Math.max(pad, maxTop);

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

  // -----------------------------
  // TAB STATE (local UI only)
  // -----------------------------
  const [activeTab, setActiveTab] = useState<PanelTab>("explain");

  // -----------------------------
  // what to show in the body
  // -----------------------------
  function renderActiveTabBody() {
  switch (activeTab) {
    case "explain": {
      // Handle errors first
      if (explainError) return explainError;
      if (summaryError) return summaryError;

      // We only show the loading placeholders if we are loading
      // AND we haven't received any streamed text yet.
      const showSummaryLoading = summaryLoading && !summaryText;
      const showExplainLoading = explainLoading && !explainText;

      return (
        <>
          <div id="lb-panel-content-heading">
            {showSummaryLoading ? "…summarizing" : summaryText}
          </div>
          <div id="lb-panel-body">
            {showExplainLoading ? "…thinking" : explainText}
          </div>
        </>
      );
    }

    case "key": {
      if (keyIdeasError) return keyIdeasError;

      // Only block-render the placeholder if nothing has streamed in yet.
      if (keyIdeasLoading && !keyIdeasText) {
        return "…finding key ideas";
      }

      return (
        <div
          id="lb-panel-body"
          dangerouslySetInnerHTML={{
            __html: marked.parse(keyIdeasText || ""),
          }}
        />
      );
    }

    case "analogy": {
      if (analogyError) return analogyError;

      if (analogyLoading && !analogyText) {
        return "…coming up with an analogy";
      }

      return (
        <div
          id="lb-panel-body"
          dangerouslySetInnerHTML={{
            __html: marked.parse(analogyText || ""),
          }}
        />
      );
    }

    case "quiz": {
      if (quizError) return quizError;

      if (quizLoading && !quizText) {
        return "…writing a quiz question";
      }

      return (
        <div
          id="lb-panel-body"
          dangerouslySetInnerHTML={{
            __html: marked.parse(quizText || ""),
          }}
        />
      );
    }

    default:
      return null;
  }
}

  // -----------------------------
  // Add Card (uses props now)
  // -----------------------------
  function handleAddClick() {
    // Always use summaryText as "front"
    const front = summaryText?.trim()
      ? summaryText
      : `Summary of "${sourceText ?? "this topic"}"`;

    let back = "";

    if (activeTab === "key") {
      back = keyIdeasText;
    } else if (activeTab === "quiz") {
      back = quizText;
    } else if (activeTab === "analogy") {
      back = analogyText;
    } else {
      // default explain
      back = explainText;
    }

    onAdd(front, back);
  }

  // -----------------------------
  // JSX
  // -----------------------------
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
        <div id="lb-panel-header-title">
          <div id="lb-panel-header-title-main">Learning Buddy</div>
          <div id="lb-panel-header-title-sub">AI explanation panel</div>
        </div>

        <div id="lb-panel-header-actions">
          {/* <button onClick={handleAddClick}>Make Card</button> */}
          <button onClick={onClose}>Close</button>
        </div>
      </div>

      {/* TAB BAR */}
      <div id="lb-panel-tabs">
        <button
          className={
            "lb-tab-btn" + (activeTab === "explain" ? " lb-tab-active" : "")
          }
          onClick={() => {
            setActiveTab("explain");
            onTabChange?.("explain");
          }}
        >
          Explanation
        </button>

        <button
          className={
            "lb-tab-btn" + (activeTab === "key" ? " lb-tab-active" : "")
          }
          onClick={() => {
            setActiveTab("key");
            onTabChange?.("key");
          }}
        >
          Key Ideas
        </button>

        <button
          className={
            "lb-tab-btn" + (activeTab === "analogy" ? " lb-tab-active" : "")
          }
          onClick={() => {
            setActiveTab("analogy");
            onTabChange?.("analogy");
          }}
        >
          Analogy
        </button>

        <button
          className={
            "lb-tab-btn" + (activeTab === "quiz" ? " lb-tab-active" : "")
          }
          onClick={() => {
            setActiveTab("quiz");
            onTabChange?.("quiz");
          }}
        >
          Quiz Me
        </button>
      </div>

      {/* BODY */}
      <div id="lb-panel-tab-body">{renderActiveTabBody()}</div>

      {/* FOOTER */}
      <div id="lb-panel-footer"><button onClick={handleAddClick}>Make Card</button></div>
      
      {/* {sourceText ? (
        <div id="lb-panel-footer">
          <div id="lb-panel-source">
            Based on: <span className="lb-source-frag">{sourceText}</span>
          </div>
          <button onClick={handleAddClick}>Make Card</button>
        </div>
      ) : null} */}
    </div>
  );
};