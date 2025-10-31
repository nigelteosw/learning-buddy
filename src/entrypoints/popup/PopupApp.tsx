import React, { useState, useEffect } from "react";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { isExtensionEnabled } from "@/lib/settings"; // 1. Import your new setting

function PopupApp() {
  const cardCount = useLiveQuery(() => db.cards.count(), [], 0);

  // 2. Add state for the toggle
  const [isEnabled, setIsEnabled] = useState(true);

  // 3. Load the setting's value when the popup opens
  useEffect(() => {
    // Get the current value
    isExtensionEnabled.getValue().then(setIsEnabled);

    // Also watch for changes (if the user changes it in settings)
    const unwatch = isExtensionEnabled.watch((newValue) => {
      setIsEnabled(newValue);
    });

    return () => unwatch(); // Cleanup the watcher
  }, []);

  // 4. Handle clicking the toggle
  const handleToggle = async () => {
    const newState = !isEnabled;
    setIsEnabled(newState);
    await isExtensionEnabled.setValue(newState);
  };

  /**
   * A reusable helper to open the side panel and send a message.
   * @param message The message to send to the side panel's App component.
   */
  const openSidePanelAndSendMessage = async (message: { type: string }) => {
    try {
      const [activeTab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (activeTab?.id) {
        await browser.sidePanel.open({ tabId: activeTab.id });
      } else {
        console.warn("Could not find active tab, falling back to window.");
        const currentWindow = await browser.windows.getCurrent();
        if (currentWindow.id !== undefined) {
          await browser.sidePanel.open({ windowId: currentWindow.id });
        } else {
          console.error("Failed to get a valid tab or window ID to open the side panel.");
          return;
        }
      }

      // Wait a moment for the panel to be ready before sending the message
      await new Promise((resolve) => setTimeout(resolve, 150));
      await browser.runtime.sendMessage(message);

    } catch (error) {
      console.error("Error opening side panel and sending message:", error);
    } finally {
      window.close();
    }
  };

  const handleOpenPanel = () => openSidePanelAndSendMessage({ type: "show-add-card" });
  const handleOpenList = () => openSidePanelAndSendMessage({ type: "show-browse-cards" });
  const handleOpenTest = () => openSidePanelAndSendMessage({ type: "show-test" });
  const handleOpenImportExport = () => openSidePanelAndSendMessage({ type: "show-import-export" });

  return (
    <main className="w-48 space-y-3 bg-zinc-900 p-3 font-sans text-white">
      <div className="flex items-center justify-between">
        <h1 className="font-semibold">Learning Buddy</h1>
        {/* --- 5. ADD THE TOGGLE SWITCH --- */}
        <button
          onClick={handleToggle}
          role="switch"
          aria-checked={isEnabled}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
            isEnabled ? "bg-blue-600" : "bg-zinc-700"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              isEnabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* 6. Conditionally render the main controls */}
      {isEnabled ? (
        <>
          <p className="text-center text-sm text-zinc-400">
            {cardCount} cards saved
          </p>
          <div className="flex flex-col space-y-2">
            <button
              onClick={handleOpenPanel}
              className="rounded-md bg-zinc-800 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
            >
              Add New Card
            </button>
            <button
              onClick={handleOpenTest}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
            >
              Test Me!
            </button>
            <button
              onClick={handleOpenList}
              className="rounded-md bg-zinc-800 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
            >
              Review Cards
            </button>
            <button
              onClick={handleOpenImportExport}
              className="rounded-md bg-zinc-800 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
            >
              Import/Export
            </button>
          </div>
        </>
      ) : (
        <p className="text-center text-sm text-zinc-400">
          Extension is currently disabled.
        </p>
      )}

      <hr className="border-zinc-700" />
      <p className="text-center text-xs text-zinc-500">
        💾 Saved locally
      </p>
    </main>
  );
}

export default PopupApp;
