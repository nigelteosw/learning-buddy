import React from "react";
import { createRoot, Root } from "react-dom/client";
import { Panel } from "@/components/Panel";
import { SelectionButton } from "@/lib/SelectionButton"; // Ensure this class exists and is correct
import { isExtensionEnabled } from "@/lib/settings";

// 1. REMOVE the dangerous Tailwind import
// import '@/assets/tailwind.css'
// Make sure Panel.tsx imports its own scoped Panel.css if needed

import { writerClient, defaultWriterOpts } from "@/lib/writerClient";
import {
  summarizerClient,
  defaultSummarizerOpts,
} from "@/lib/summarizerClient";

let panelHost: HTMLElement | null = null;
let reactRoot: Root | null = null;
let currentButton: SelectionButton | null = null; // Keep track of the button instance
let downloadProgress = { writer: -1, summarizer: -1 };

// --- React Panel Rendering ---
function ensureReactRoot(): Root {
  if (reactRoot) return reactRoot;

  panelHost = document.createElement("div");
  panelHost.id = "__lb-panel-host__";
  // Apply necessary base styles for the host
  panelHost.style.position = "fixed";
  panelHost.style.top = "0";
  panelHost.style.left = "0";
  panelHost.style.zIndex = "2147483647"; // Max z-index
  panelHost.style.pointerEvents = "none"; // Allow clicks to pass through normally

  document.body.appendChild(panelHost);
  reactRoot = createRoot(panelHost);
  return reactRoot;
}

function showPanel(
  originalText: string, // Keep original text for the 'Add' action
  content: string, // This is the Summarizer result (used as Heading in Panel)
  explanation: string, // 2. FIX typo: was 'explnation'. This is the Writer result.
  nearRect: DOMRect | null
) {
  const root = ensureReactRoot();

  const handleClose = () => {
    root.render(null); // Unmount the component
  };

  const handleAdd = () => {
    // 3. Use the standardized message format
    browser.runtime.sendMessage({
      type: "prefill-and-open-sidepanel",
      front: originalText,
      heading: content, // Use summarizer result as heading
      back: explanation, // Use writer result as back
    });
  };

  // Ensure the panelHost allows pointer events while the panel is shown
  if (panelHost) panelHost.style.pointerEvents = "auto";

  // Make sure Panel component props match this call
  root.render(
    <Panel
      content={content} // Pass summarizer result
      explanation={explanation} // Pass writer result
      nearRect={nearRect}
      onClose={handleClose}
      onAdd={handleAdd} // Use the simplified handleAdd
    />
  );
}

// --- Button Enable/Disable Logic ---
const setupButton = (isEnabled: boolean) => {
  if (isEnabled && !currentButton) {
    console.log("[content] Enabling button");
    currentButton = new SelectionButton();

    currentButton.setOnLearnClick(async (text, rect) => {
      downloadProgress = { writer: -1, summarizer: -1 };
      let writerAvailable = "unknown",
        summarizerAvailable = "unknown";

      showPanel(text, "Please Wait", "Checking AI...", rect);

      try {
        [writerAvailable, summarizerAvailable] = await Promise.all([
          writerClient.availability(),
          summarizerClient.availability(),
        ]);
        console.log("[content] AI Availability:", {
          writer: writerAvailable,
          summarizer: summarizerAvailable,
        });

        const needsDownload =
          writerAvailable === "downloadable" ||
          writerAvailable === "downloading" ||
          summarizerAvailable === "downloadable" ||
          summarizerAvailable === "downloading";
        const isUnavailable =
          writerAvailable === "unavailable" ||
          writerAvailable === "no-api" ||
          summarizerAvailable === "unavailable" ||
          summarizerAvailable === "no-api";

        if (isUnavailable) {
          throw new Error(
            "AI features are unavailable. Please ensure they are enabled in Chrome and your device is supported."
          );
        }

        // --- DEFINE updateProgress HERE ---
        let updateProgress = () => {}; // Default empty function
        if (needsDownload) {
          showPanel(
            text,
            "Please Wait",
            "Gemini Nano might take some time to download.",
            rect
          );

          // Define the actual function if needed
          updateProgress = () => {
            const wProg =
              downloadProgress.writer >= 0
                ? `Writer Download Progress: ${Math.round(
                    downloadProgress.writer * 100
                  )}%`
                : "";
            const sProg =
              downloadProgress.summarizer >= 0
                ? `Summarizer Download Progress: ${Math.round(
                    downloadProgress.summarizer * 100
                  )}%`
                : "";
            // Only update if download is still potentially ongoing
            if (
              downloadProgress.writer < 1 ||
              downloadProgress.summarizer < 1
            ) {
              showPanel(
                text,
                "Please Wait",
                `Downloading AI model... ${wProg} ${sProg}`,
                rect
              );
            }
          };
        } else {
          showPanel(text, "Please Wait", "Initializing AI...", rect);
        }
        // --- END DEFINITION ---

        const writerProgress = (p: number) => {
          downloadProgress.writer = p;
          if (needsDownload) updateProgress(); // Call the defined function
        };
        const summarizerProgress = (p: number) => {
          downloadProgress.summarizer = p;
          if (needsDownload) updateProgress(); // Call the defined function
        };

        // --- Initialize Sequentially ---
        writerClient.setOpts(defaultWriterOpts);
        await writerClient.initFromUserGesture({
          ...defaultWriterOpts,
          onDownloadProgress: writerProgress,
        });
        console.log("[content] Writer client initialized.");

        summarizerClient.setOpts(defaultSummarizerOpts);
        await summarizerClient.initFromUserGesture({
          ...defaultSummarizerOpts,
          onDownloadProgress: summarizerProgress,
        });
        console.log("[content] Summarizer client initialized.");

        // --- Run AI calls ---
        showPanel(text, "Please Wait", "Generating...", rect); // Initial status
        let streamedWriter = "";
        let streamedSummarizer = "";
        let summarizerFinished = false; // Flag to track when summarizer is done

        try {
          // Start both streaming calls concurrently
          const summarizerStream = await summarizerClient.summarizeStreaming(
            text,
            {}
          );
          const writerStream = await writerClient.writeStreaming(text, {});

          const summarizerPromise = (async () => {
            for await (const chunk of summarizerStream) {
              streamedSummarizer += chunk;
              // Update panel with latest summary chunk, using current writer state
              // (Don't constantly overwrite the writer's streaming output)
              // Only update the 'heading' part if needed, maybe just log progress
              console.log("Summarizer chunk:", chunk); // Log progress
              // Optionally update panel title briefly if needed:
              // showPanel(text, streamedSummarizer, streamedWriter, rect);
            }
            summarizerFinished = true; // Set flag when done
          })(); // Immediately invoked async function

          // Create promises to track when each stream finishes
          const writerPromise = (async () => {
            for await (const chunk of writerStream) {
              streamedWriter += chunk;
              // Update panel with latest writer chunk, using current summary state
              showPanel(
                text,
                summarizerFinished
                  ? streamedSummarizer || "Summary"
                  : "Summarizing...", // Show placeholder if summary not done
                streamedWriter,
                rect
              );
            }
          })(); // Immediately invoked async function

          // Wait for both streams to complete
          await Promise.all([writerPromise, summarizerPromise]);
          console.log("[content] Both AI streams complete.");

          // Final update with complete results
          showPanel(
            text,
            streamedSummarizer || "Summary",
            streamedWriter || "No output.",
            rect
          );
        } catch (err: any) {
          console.error("[content] AI streaming error:", err);
          showPanel(text, "Error", `${err?.message ?? String(err)}`, rect);
        }
      } catch (err: any) {
        console.error("[content] AI error:", err);
        showPanel(text, "Error", `${err?.message ?? String(err)}`, rect);
      }
    });

    currentButton.initializeListeners();
  } else if (!isEnabled && currentButton) {
    console.log("[content] Disabling button");
    currentButton.destroy();
    currentButton = null;
    if (reactRoot) {
      reactRoot.render(null); // Also close the panel if extension is disabled
      if (panelHost) panelHost.style.pointerEvents = "none";
    }
  }
};

// --- Content Script Definition ---
export default defineContentScript({
  matches: ["<all_urls>"],
  allFrames: true,

  main() {
    console.log("[content] loaded on", location.href);

    // 6. Setup the button based on initial setting and watch for changes
    isExtensionEnabled.getValue().then(setupButton);
    isExtensionEnabled.watch(setupButton);

    // --- Listener for Context Menu ---
    browser.runtime.onMessage.addListener(async (msg) => {
      // 7. Check if enabled before processing message
      const isEnabled = await isExtensionEnabled.getValue();
      if (
        !isEnabled ||
        msg.type !== "EXPLAIN_TEXT_FROM_CONTEXT_MENU" ||
        typeof msg.text !== "string"
      ) {
        return;
      }

      const text = msg.text.trim();
      if (!text) return;

      // Show loading panel (centered)
      showPanel(text, "Please Wait", "Writing…", null);

      try {
        // Initialize AI (must be inside user gesture - context menu click counts)
        await Promise.all([
          (async () => {
            writerClient.setOpts(defaultWriterOpts);
            await writerClient.initFromUserGesture(defaultWriterOpts);
          })(),
          (async () => {
            summarizerClient.setOpts(defaultSummarizerOpts);
            await summarizerClient.initFromUserGesture(defaultSummarizerOpts);
          })(),
        ]);

        // Run AI calls
        const [writerResult, summarizerResult] = await Promise.all([
          writerClient.write(text, {}),
          summarizerClient.summarize(text, {}),
        ]);

        // Show result panel (centered)
        showPanel(
          text,
          summarizerResult || "Summary",
          writerResult || "No output.",
          null
        );
      } catch (err: any) {
        console.error("[content] AI error (from context menu):", err);
        showPanel(text, "Error", `${err?.message ?? String(err)}`, null);
      }
    });
  },
});

// --- Helper type definition for SelectionButton (assuming it needs setOnLearnClick) ---
// You might need to adjust SelectionButton.ts to match this
declare module "@/lib/SelectionButton" {
  interface SelectionButton {
    setOnLearnClick(
      callback: (text: string, rect: DOMRect | null) => Promise<void>
    ): void;
  }
}
