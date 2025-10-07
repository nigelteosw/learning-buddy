import { defineContentScript } from "wxt/utils/define-content-script";
import { summarizerClient, defaultOpts } from "@/src/lib/summarizerClient";
import { writerClient, defaultWriterOpts } from "@/src/lib/writerClient";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Panel } from "@/src/components/Panel";

export default defineContentScript({
  matches: ["<all_urls>"],
  allFrames: true,
  main() {
    console.log("[content] loaded on", location.href);

    const BTN_ID = "__lb-float-btn__";
    const HOST_ID = "__lb-writer-panel__";
    let btn: HTMLButtonElement | null = null;

    let lastText: string | null = null;
    let lastRect: DOMRect | null = null;
    let clickBusy = false;
    let panelHost: HTMLElement | null = null;

    // ...

    function placeButton() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return hide();

      let rect: DOMRect | null = null;
      try {
        rect = sel.getRangeAt(0).getBoundingClientRect();
      } catch {
        rect = null;
      }
      const text = sel.toString().trim();

      if (!text || !rect || (rect.width === 0 && rect.height === 0)) {
        return hide();
      }

      // cache for click handler
      lastText = text;
      lastRect = rect;

      const b = ensureButton();
      b.style.top = `${Math.max(8, rect.top - 36)}px`;
      b.style.left = `${Math.max(8, rect.left)}px`;
      b.style.display = "block";
    }

    // ---------------------------
    // React mount
    // ---------------------------
    let root: ReturnType<typeof createRoot> | null = null;

    // ✅ define it first
    function ensureReactRoot() {
      if (root) return root;
      panelHost = document.createElement("div");
      const shadow = panelHost.attachShadow({ mode: "open" });
      const mount = document.createElement("div");
      shadow.appendChild(mount);
      document.body.appendChild(panelHost);
      root = createRoot(mount);
      return root;
    }

    function showPanel(content: string, nearRect: DOMRect | null) {
      const r = ensureReactRoot();
      const close = () => r.render(<></>); // unmount
      r.render(<Panel content={content} nearRect={nearRect} onClose={close} />);
    }

    // ---------------------------
    // Floating "Learn" button
    // ---------------------------
    function ensureButton() {
      if (!btn) {
        btn = document.createElement("button");
        btn.id = BTN_ID;
        btn.textContent = "Learn";
        Object.assign(btn.style, {
          position: "fixed",
          display: "none",
          zIndex: "2147483647",
          background: "#111",
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          padding: "6px 10px",
          boxShadow: "0 4px 12px rgba(0,0,0,.25)",
          cursor: "pointer",
          pointerEvents: "auto",
        } as CSSStyleDeclaration);
        document.documentElement.appendChild(btn);

        btn.addEventListener("mousedown", (e) => {
          // prevent some sites from clearing selection before click
          e.preventDefault();
        });

        btn.addEventListener("click", async () => {
          if (clickBusy) return;
          clickBusy = true;

          const text = (lastText ?? "").trim();
          const rect = lastRect; // may be null; Panel will center itself

          hide(); // hide bubble immediately
          try {
            if (!text) {
              showPanel("⚠️ No selection found.", null);
              return;
            }

            // init & show loading immediately using cached rect (or center)
            writerClient.setOpts(defaultWriterOpts);
            await writerClient.initFromUserGesture(defaultWriterOpts);

            showPanel("Writing…", rect ?? null);

            const result = await writerClient.write(text, {});
            showPanel(result || "No output.", rect ?? null);
          } catch (e: any) {
            showPanel(`⚠️ ${e?.message ?? String(e)}`, null);
          } finally {
            // keep cache for possible re-open (optional: clear here if you prefer)
            clickBusy = false;
          }
        });
      }
      return btn!;
    }

    function hide() {
      if (btn) btn.style.display = "none";
    }

    document.addEventListener("mouseup", (ev) => {
      // ❗ Ignore if mouseup happened inside our panel
      if (panelHost && panelHost.contains(ev.target as Node)) return;

      const t = window.getSelection()?.toString().trim() || "";
      if (t) placeButton();
      else hide();
    });

    document.addEventListener("selectionchange", (ev) => {
      // ❗ Ignore if selection change is within our panel
      const active = (ev.target as Node) ?? document.activeElement;
      if (panelHost && panelHost.contains(active)) return;

      const t = window.getSelection()?.toString().trim() || "";
      if (!t) hide();
    });

    window.addEventListener(
      "scroll",
      () => {
        // Only hide if scroll isn’t happening inside our Shadow DOM
        const active = document.activeElement;
        if (panelHost && panelHost.contains(active)) return;
        hide();
      },
      { passive: true }
    );

    window.addEventListener("resize", hide);
    document.addEventListener("keydown", (e) => {
      // let Escape close only if pressed outside panel
      if (
        e.key === "Escape" &&
        (!panelHost || !panelHost.contains(e.target as Node))
      )
        hide();
    });
  },
});
