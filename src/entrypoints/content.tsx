import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Panel } from '@/components/Panel';
import { SelectionButton } from '@/lib/SelectionButton';
import { isExtensionEnabled } from '@/lib/settings';


import { writerClient, defaultWriterOpts } from '@/lib/writerClient';
import { summarizerClient, defaultSummarizerOpts } from '@/lib/summarizerClient';

let panelHost: HTMLElement | null = null;
let reactRoot: Root | null = null;

function ensureReactRoot(): Root {
  if (reactRoot) return reactRoot;

  panelHost = document.createElement("div");
  panelHost.id = "__lb-panel-host__";

  panelHost.style.position = "fixed";
  panelHost.style.top = "0";
  panelHost.style.left = "0";
  panelHost.style.zIndex = "2147483647";

  document.body.appendChild(panelHost);

  reactRoot = createRoot(panelHost);
  return reactRoot;
}

function showPanel(
  content: string,
  explnation: string,
  nearRect: DOMRect | null
) {
  const root = ensureReactRoot();

  const handleClose = () => {
    root.render(null);
  };

  const handleAdd = (contentToSave: string, explanationToSave: string) => {
    // 1. Tell the side panel app what to prefill
    browser.runtime.sendMessage({
      type: 'explain-text',
      text: contentToSave,
      explanation: explanationToSave,
    });

    // 2. (Optional but nice) ask background to open the side panel
    // We can't call browser.sidePanel.open(...) directly here in content script
    // in all Chrome versions, so forward a "open-sidepanel" request to background.
    browser.runtime.sendMessage({
      type: 'open-sidepanel',
    });

  };

  root.render(
    <Panel
      content={content}
      explanation={explnation}
      nearRect={nearRect}
      onClose={handleClose}
      onAdd={handleAdd} 
    />
  );
}

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,

  async main() {
    console.log('[content] loaded on', location.href);

    // Prep writerClient once, so first click feels faster
    // (Your old code had an initFromUserGesture step which must run on user gesture)
    // We'll call that lazily at first use below. You can also pre-warm here if allowed.

    // Create the floating Learn button
    const button = new SelectionButton({
      onExplainRequested: async (text, rect) => {
        // 1. Immediately show a "loading" panel near the selection
        showPanel('Please Wait' ,'Writing…', rect);

        try {
          
          writerClient.setOpts(defaultWriterOpts);
          await writerClient.initFromUserGesture(defaultWriterOpts);
          
          const writerResult = await writerClient.write(text, {});

          summarizerClient.setOpts(defaultSummarizerOpts);
          await summarizerClient.initFromUserGesture(defaultSummarizerOpts);
          
          const summarizerResult = await summarizerClient.summarize(text, {});

          // 4. Show the result
          showPanel(summarizerResult || 'No output.', writerResult || 'No output.', rect);
        } catch (err: any) {
          console.error('[content] writer error:', err);
          showPanel('Error', `${err?.message ?? String(err)}`, rect);
        }
      },
    });

    button.initializeListeners();

    // Listen for background context menu path
    chrome.runtime.onMessage.addListener(async (msg) => {
      if (
        msg.type === 'EXPLAIN_TEXT_FROM_CONTEXT_MENU' &&
        typeof msg.text === 'string'
      ) {
        const text = msg.text.trim();
        if (!text) return;

        // For context menu we don't have a selection rect in-page,
        // so pass null to dock panel bottom-right.
        showPanel('Please Wait', 'Writing…', null);

        try {
          writerClient.setOpts(defaultWriterOpts);
          await writerClient.initFromUserGesture(defaultWriterOpts);

          const writerResult = await writerClient.write(text, {});
          
          summarizerClient.setOpts(defaultSummarizerOpts);
          await summarizerClient.initFromUserGesture(defaultSummarizerOpts);
          
          const summarizerResult = await summarizerClient.summarize(text, {});
          
          showPanel(summarizerResult || 'No output.' , writerResult || 'No output.', null);
        } catch (err: any) {
          console.error('[content] writer error (from context menu):', err);
          showPanel('Error', `${err?.message ?? String(err)}`, null);
        }
      }
    });
  },
});