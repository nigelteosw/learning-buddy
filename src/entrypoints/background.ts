/**
 * Defines message types for communication between different parts of the extension.
 * Using a constant object helps prevent typos and provides a single source of truth.
 */
const MessageTypes = {
  SIDE_PANEL_READY: 'sidepanel-ready',
  PREFILL_AND_OPEN_SIDEPANEL: 'prefill-and-open-sidepanel',
  PREFILL_DATA: 'prefill-data',
  EXPLAIN_TEXT_FROM_CONTEXT_MENU: 'EXPLAIN_TEXT_FROM_CONTEXT_MENU',
} as const;

export default defineBackground(() => {
  console.log('[bg] background script loaded');

  /**
   * Listens for messages from content scripts and the side panel.
   */
  browser.runtime.onMessage.addListener(async (message, sender) => {
    // This message is sent from the content script when a user wants to create a new card.
    if (message.type === MessageTypes.PREFILL_AND_OPEN_SIDEPANEL && sender.tab?.id) {
      console.log('[bg] Received prefill request:', message);
      try {
        // 1. Open the side panel for the tab that sent the message
        await browser.sidePanel.open({ tabId: sender.tab.id });

        // 2. Forward the data to the side panel
        // We use runtime.sendMessage, which will be received by the side panel's own listener.
        console.log('[bg] Side panel opened, attempting to send prefill-data via runtime...');
        await browser.runtime.sendMessage({
          type: MessageTypes.PREFILL_DATA,
          data: {
            front: message.data.front,
            heading: message.data.heading,
            back: message.data.back,
          },
        });
        console.log('[bg] Prefill data sent to runtime for tab:', sender.tab.id);
      } catch (e) {
        console.error("[bg] Error handling prefill message:", e);
      }
      // Return true if you might respond asynchronously later, but here we don't need to.
      // return true;
    }
  });

  /**
   * Creates the context menu item upon installation.
   */
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: 'explain-selection',
      title: 'Explain with AI Tutor',
      contexts: ['selection'],
    });
  });

  /**
   * Handles clicks on the context menu item.
   */
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'explain-selection' && tab?.id && info.selectionText) {
      // Send a message to the content script in the active tab.
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: MessageTypes.EXPLAIN_TEXT_FROM_CONTEXT_MENU,
          text: info.selectionText,
        });
        console.log('[bg] Context menu click sent to content script for tab:', tab.id);

        // Optional: You could also open the side panel immediately here if desired.
        // await browser.sidePanel.open({ tabId: tab.id });

      } catch (e) {
        console.error("[bg] Could not send context menu message to content script:", e);
      }
    }
  });
});