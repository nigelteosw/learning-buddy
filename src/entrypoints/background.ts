export default defineBackground(() => {
  console.log('[bg] background script loaded');

  const sidepanelReady = new Set<number>();

  // --- Listener for messages from Content Script ---
  browser.runtime.onMessage.addListener(async (message, sender) => {
    if (message.type === 'sidepanel-ready' && sender.tab?.id) {
      sidepanelReady.add(sender.tab.id);
      return; // done
    }
    // Check if the message is from your content script asking to prefill
    console.log('[bg] Received message:', message);
    if (message.type === 'prefill-and-open-sidepanel' && sender.tab?.id) {
      try {
        // 1. Open the side panel for the tab that sent the message
        await browser.sidePanel.open({ tabId: sender.tab.id });

        // 2. Forward the data to the side panel
        // (Use tabs.sendMessage to target the specific side panel instance)
        console.log('[bg] Side panel opened, attempting to send prefill-data via runtime...');
        await browser.runtime.sendMessage({ // Use runtime.sendMessage
          type: 'prefill-data',
          data: {
            front: message.front,
            heading: message.heading,
            back: message.back,
          },
        });
        console.log('[bg] Prefill data sent to side panel for tab:', sender.tab.id);
      } catch (e) {
        console.error("[bg] Error handling prefill message:", e);
      }
      // Return true if you might respond asynchronously later, but here we don't need to.
      // return true;
    }
  });

  // --- Your existing context menu logic ---
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: 'explain-selection',
      title: 'Explain with AI Tutor',
      contexts: ['selection'],
    });
  });

  // When the context menu item is clicked
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'explain-selection' && tab?.id && info.selectionText) {
      // Send message *to the content script* in that tab to trigger AI
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'EXPLAIN_TEXT_FROM_CONTEXT_MENU',
          text: info.selectionText,
        });
        console.log('[bg] Context menu click sent to content script for tab:', tab.id);

        // Optional: Open the side panel immediately if you want
        // await browser.sidePanel.open({ tabId: tab.id });

      } catch (e) {
        console.error("[bg] Could not send context menu message to content script:", e);
      }
    }
  });
});