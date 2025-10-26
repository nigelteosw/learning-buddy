import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Panel } from '@/components/Panel';
import { SelectionButton } from '@/lib/SelectionButton';
import '@/assets/tailwind.css'

import { writerClient, defaultWriterOpts } from '@/lib/writerClient';

let panelHost: HTMLElement | null = null;
let reactRoot: Root | null = null;

function ensureReactRoot(): Root {
  if (reactRoot) return reactRoot;

  panelHost = document.createElement('div');

  const shadow = panelHost.attachShadow({ mode: 'open' });
  const mount = document.createElement('div');
  shadow.appendChild(mount);

  document.body.appendChild(panelHost);

  reactRoot = createRoot(mount);
  return reactRoot;
}

function showPanel(content: string, nearRect: DOMRect | null) {
  const root = ensureReactRoot();

  const handleClose = () => {
    root.render(null); // clear panel
  };

  root.render(
    <Panel
      content={content}
      nearRect={nearRect}
      onClose={handleClose}
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
        // showPanel('Writing…', rect);

        try {
          // 2. Make sure writerClient is initialized
          writerClient.setOpts(defaultWriterOpts);
          await writerClient.initFromUserGesture(defaultWriterOpts);
          // ^ this MUST be called from a user gesture. Good news:
          // this callback is literally running in response to the user's click
          // on the Learn button, so it's legit.

          // 3. Ask the Writer API for output
          const result = await writerClient.writeStreaming(text, {});

          // 4. Show the result
          showPanel(result || 'No output.', rect);
        } catch (err: any) {
          console.error('[content] writer error:', err);
          showPanel(`⚠️ ${err?.message ?? String(err)}`, rect);
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
        showPanel('Writing…', null);

        try {
          writerClient.setOpts(defaultWriterOpts);
          await writerClient.initFromUserGesture(defaultWriterOpts);

          const result = await writerClient.write(text, {});
          showPanel(result || 'No output.', null);
        } catch (err: any) {
          console.error('[content] writer error (from context menu):', err);
          showPanel(`⚠️ ${err?.message ?? String(err)}`, null);
        }
      }
    });
  },
});