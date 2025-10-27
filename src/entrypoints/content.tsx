import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Panel } from '@/components/Panel';
import { SelectionButton } from '@/lib/SelectionButton'; // Ensure this class exists and is correct
import { isExtensionEnabled } from '@/lib/settings';

// 1. REMOVE the dangerous Tailwind import
// import '@/assets/tailwind.css'
// Make sure Panel.tsx imports its own scoped Panel.css if needed

import { writerClient, defaultWriterOpts } from '@/lib/writerClient';
import { summarizerClient, defaultSummarizerOpts } from '@/lib/summarizerClient';

let panelHost: HTMLElement | null = null;
let reactRoot: Root | null = null;
let currentButton: SelectionButton | null = null; // Keep track of the button instance

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
  content: string,      // This is the Summarizer result (used as Heading in Panel)
  explanation: string,  // 2. FIX typo: was 'explnation'. This is the Writer result.
  nearRect: DOMRect | null
) {
  const root = ensureReactRoot();

  const handleClose = () => {
    root.render(null); // Unmount the component
  };

  const handleAdd = () => {
    // 3. Use the standardized message format
    browser.runtime.sendMessage({
      type: 'prefill-and-open-sidepanel',
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
      content={content}       // Pass summarizer result
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
    console.log('[content] Enabling button');
    // 4. FIX: Instantiate SelectionButton correctly (assuming its constructor takes no args)
    // The logic to call AI now happens inside this content script, triggered by the button
    currentButton = new SelectionButton();
    currentButton.setOnLearnClick(async (text, rect) => { // 5. Use a callback instead of passing func in constructor
      // Immediately show a "loading" panel
      showPanel(text, 'Please Wait', 'Writing…', rect);

      try {
        // Initialize AI clients concurrently
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

        // Run AI calls concurrently
        const [writerResult, summarizerResult] = await Promise.all([
           writerClient.write(text, {}),
           summarizerClient.summarize(text, {})
        ]);

        // Show the result
        showPanel(
          text,
          summarizerResult || 'Summary',
          writerResult || 'No output.',
          rect
        );
      } catch (err: any) {
        console.error('[content] AI error:', err);
        showPanel(text, 'Error', `${err?.message ?? String(err)}`, rect);
      }
    });
    currentButton.initializeListeners();

  } else if (!isEnabled && currentButton) {
    console.log('[content] Disabling button');
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

    // 6. Setup the button based on initial setting and watch for changes
    isExtensionEnabled.getValue().then(setupButton);
    isExtensionEnabled.watch(setupButton);

    // --- Listener for Context Menu ---
    browser.runtime.onMessage.addListener(async (msg) => {
      // 7. Check if enabled before processing message
      const isEnabled = await isExtensionEnabled.getValue();
      if (!isEnabled || msg.type !== 'EXPLAIN_TEXT_FROM_CONTEXT_MENU' || typeof msg.text !== 'string') {
        return;
      }

      const text = msg.text.trim();
      if (!text) return;

      // Show loading panel (centered)
      showPanel(text, 'Please Wait', 'Writing…', null);

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
           summarizerClient.summarize(text, {})
        ]);

        // Show result panel (centered)
        showPanel(
          text,
          summarizerResult || 'Summary',
          writerResult || 'No output.',
          null
        );
      } catch (err: any) {
        console.error('[content] AI error (from context menu):', err);
        showPanel(text, 'Error', `${err?.message ?? String(err)}`, null);
      }
    });
  },
});

// --- Helper type definition for SelectionButton (assuming it needs setOnLearnClick) ---
// You might need to adjust SelectionButton.ts to match this
declare module '@/lib/SelectionButton' {
  interface SelectionButton {
    setOnLearnClick(callback: (text: string, rect: DOMRect | null) => Promise<void>): void;
  }
}