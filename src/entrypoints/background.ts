// background.ts

export default defineBackground(() => {
  console.log('[bg] background script loaded');

  // Create context menu on install
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
      // Optional: open side panel for that tab, like before
      try {
        // @ts-ignore - depends on browser.sidePanel being available in MV3
        await browser.sidePanel.open({ tabId: tab.id });
      } catch (err) {
        // sidePanel is Chrome-only and behind flags in some channels, so ignore errors
        console.warn('[bg] sidePanel.open failed or not supported:', err);
      }

      // Send message to the content script in that tab
      chrome.tabs.sendMessage(tab.id, {
        type: 'EXPLAIN_TEXT_FROM_CONTEXT_MENU',
        text: info.selectionText,
      });
    }
  });
});
