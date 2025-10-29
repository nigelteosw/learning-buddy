// src/entrypoints/content.tsx
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Panel } from '@/components/Panel'; // Ensure Panel accepts stream props
import { SelectionButton } from '@/lib/SelectionButton';
import { isExtensionEnabled } from '@/lib/settings';
import { writerClient, defaultWriterOpts } from '@/lib/modelClients/writerClient';
import { summarizerClient, defaultSummarizerOpts } from '@/lib/modelClients/summarizerClient';
import { promptClient, defaultPromptOpts } from '@/lib/modelClients/promptClient';


let panelHost: HTMLElement | null = null;
let reactRoot: Root | null = null;
let currentButton: SelectionButton | null = null;

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
  originalText: string,
  initialContent: string,
  initialExplanation: string,
  nearRect: DOMRect | null,
  // Add optional stream props
  contentStream?: AsyncIterable<string>,
  explanationStream?: AsyncIterable<string>
) {
  const root = ensureReactRoot();
  const handleClose = () => { root.render(null); };
  const handleAdd = (finalContent: string, finalExplanation: string) => {
    browser.runtime.sendMessage({
      type: 'prefill-and-open-sidepanel',
      front: originalText,
      heading: finalContent,
      back: finalExplanation,
    });
    // handleClose();
  };

  if (panelHost) panelHost.style.pointerEvents = "auto";

  // Pass streams down to the Panel component
  root.render(
    <Panel
      initialContent={initialContent}
      initialExplanation={initialExplanation}
      contentStream={contentStream}           // Pass stream
      explanationStream={explanationStream}   // Pass stream
      nearRect={nearRect}
      onClose={handleClose}
      onAdd={handleAdd}
    />
  );
}

// --- Button Enable/Disable Logic ---
const setupButton = (isEnabled: boolean) => {
  if (isEnabled && !currentButton) {
    console.log('[content] Enabling button');
    currentButton = new SelectionButton();

    currentButton.setOnLearnClick(async (text, rect) => {
      // Show initial loading panel (no streams yet)
      let downloadProgress = { writer: -1, summarizer: -1 };
      let writerAvailable = "unknown",
        summarizerAvailable = "unknown";

      showPanel(text, "Please Wait", "Checking AI...", rect);

      try {
        // --- Availability Check (Keep as is) ---
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
        summarizerClient.setOpts(defaultSummarizerOpts);
        await summarizerClient.initFromUserGesture({
          ...defaultSummarizerOpts,
          onDownloadProgress: summarizerProgress,
        });
        console.log("[content] Summarizer client initialized.");


        writerClient.setOpts(defaultWriterOpts);
        await writerClient.initFromUserGesture({
          ...defaultWriterOpts,
          onDownloadProgress: writerProgress,
        });
        console.log("[content] Writer client initialized.");

        promptClient.setOpts(defaultPromptOpts);
        await promptClient.initFromUserGesture({
          ...defaultPromptOpts,
        });
        console.log("[content] Prompt client initialized.");
        
        // --- Get Streams and Pass Them Down ---
        showPanel(text, 'Please Wait', 'Generating...', rect); // Update status

        // Get the streams WITHOUT consuming them here
        const summarizerStream = await summarizerClient.summarizeStreaming(text, {});
        const writerStream = await writerClient.writeStreaming(text, {});
        
        console.log("[content] Got AI streams.");

        // Re-render the panel, passing the streams down
        // The Panel component will handle consuming them via useEffect
        showPanel(
            text,
            '',               // Start with empty summary
            '',               // Start with empty explanation
            rect,
            summarizerStream, // Pass the summarizer stream
            writerStream      // Pass the writer stream
        );
        // --- End Stream Passing ---

      } catch (err: any) {
        console.error('[content] AI error:', err);
        // Render panel in error state (no streams)
        showPanel(text, 'Error', `${err?.message ?? String(err)}`, rect);
      }
    }); // End setOnLearnClick

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
  matches: ['<all_urls>'],
  allFrames: true,
  main() {
    console.log('[content] loaded on', location.href);
    isExtensionEnabled.getValue().then(setupButton);
    isExtensionEnabled.watch(setupButton);

    browser.runtime.onMessage.addListener(async (msg) => {
      const isEnabled = await isExtensionEnabled.getValue();
      // ... (Check message validity - unchanged) ...
       if (!isEnabled || msg.type !== 'EXPLAIN_TEXT_FROM_CONTEXT_MENU' || typeof msg.text !== 'string') return;
       const text = msg.text.trim();
       if (!text) return;


      // Show initial loading panel (centered, no streams yet)
      showPanel(text, 'Please Wait', 'Initializing AI...', null);

      try {
        // --- Initialize (Keep sequential or concurrent as needed for context menu) ---
        // Context menu click IS a user gesture, so init should work. Concurrent might be okay here.
         await Promise.all([
          writerClient.initFromUserGesture(defaultWriterOpts),
          summarizerClient.initFromUserGesture(defaultSummarizerOpts),
        ]);

        // --- Get Streams and Pass Them Down ---
        showPanel(text, 'Please Wait', 'Generating...', null); // Update status

        const writerStream = await writerClient.writeStreaming(text, {});
        const summarizerStream = await summarizerClient.summarizeStreaming(text, {});
        console.log("[content] Got AI streams (from context menu).");

        // Re-render panel with streams (centered)
        showPanel(
            text,
            '', '', // Start empty
            null, // Centered
            summarizerStream,
            writerStream
        );
        // --- End Stream Passing ---

      } catch (err: any) {
        console.error('[content] AI error (from context menu):', err);
        showPanel(text, 'Error', `${err?.message ?? String(err)}`, null);
      }
    }); // End listener
  }, // End main
}); // End defineContentScript

// --- Helper type definition for SelectionButton (assuming it needs setOnLearnClick) ---
// You might need to adjust SelectionButton.ts to match this
declare module "@/lib/SelectionButton" {
  interface SelectionButton {
    setOnLearnClick(
      callback: (text: string, rect: DOMRect | null) => Promise<void>
    ): void;
  }
}
