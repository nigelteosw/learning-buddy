import React, { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { isExtensionEnabled } from '@/lib/settings'; // 1. Import your new setting

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

  // ... (handleOpenPanel and handleOpenReview are unchanged) ...
  const handleOpenPanel = async () => { /* ... */ };
  const handleOpenReview = async () => { /* ... */ };

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
            isEnabled ? 'bg-blue-600' : 'bg-zinc-700'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              isEnabled ? 'translate-x-5' : 'translate-x-0'
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
          <hr className="border-zinc-700" />
          <div className="flex flex-col space-y-2">
            <button
              onClick={handleOpenPanel}
              className="rounded-md bg-zinc-800 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
            >
              Add New Card
            </button>
            <button
              onClick={handleOpenReview}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
            >
              Review Cards
            </button>
          </div>
        </>
      ) : (
        <p className="text-center text-sm text-zinc-400">
          Extension is currently disabled.
        </p>
      )}
    </main>
  );
}

export default PopupApp;