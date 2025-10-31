import React, { useState, useEffect } from 'react';
import { db, Card } from '@/lib/db'; // 1. Import Card type
import { useLiveQuery } from 'dexie-react-hooks';
import { AddCardForm } from '@/components/AddCardForm';
import { ReviewList } from '@/components/review-list/ReviewList';
import { TestPage } from '@/components/test-game/TestPage';
import { ImportExport } from '@/components/ImportExport';
import { HelpAndCredits } from '@/components/HelpAndCredits';


function App() {
  const [frontText, setFrontText] = useState('');
  const [originalHighlight, setOriginalHighlight] = useState('');
  const [activeTab, setActiveTab] = useState<'addCard' | 'test' | 'browseCards' | 'importExport' | 'help'>('addCard');
  const [cardToEdit, setCardToEdit] = useState<Card | null>(null);
  const [initialPrefillData, setInitialPrefillData] = useState<{ heading: string; back: string } | null>(null);

  // Keep count for the tab button
  const cardCount = useLiveQuery(() => db.cards.count(), [], 0);

  // Message listener (no changes needed here)
  useEffect(() => {
    const messageListener = (message: any) => {
      // ... (handles 'explain-text', 'show-test', 'prefill-data')
      if (message.type === 'explain-text' && message.text) {
        console.log('App received explain-text:', message.text);
        setOriginalHighlight(message.text);
        setFrontText(message.text);
        setCardToEdit(null);
        setInitialPrefillData(null);
        setActiveTab('addCard');
      }
      if (message.type === 'show-test') {
        console.log('App received show-test');
        setActiveTab('test');
      }
      if (message.type === 'prefill-and-open-sidepanel' && message.data) {
        console.log('App received prefill-and-open-sidepanel:', message.data);
        setFrontText(message.data.front);
        setOriginalHighlight(message.data.front);
        setCardToEdit(null);
        setInitialPrefillData({
          heading: message.data.front,
          back: message.data.back,
        });
        setActiveTab('addCard');
      }
    };
    browser.runtime.onMessage.addListener(messageListener);
    return () => {
      browser.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  // Callback after saving/updating (no changes needed)
  const handleCardSaved = () => {
    setOriginalHighlight('');
    setFrontText('');
    setInitialPrefillData(null);
    setCardToEdit(null);
    setActiveTab('test'); // Switch to Test after save might be desired
  };

  // Handler for edit requests (keep for now, might use later)
  const handleEditRequest = (card: Card) => {
    setCardToEdit(card);
    setInitialPrefillData(null);
    setActiveTab('addCard');
  };


  return (
    <main className="min-h-screen space-y-4 bg-zinc-900 p-4 font-sans text-white">
      {/* --- TABS --- */}
      <div className="flex border-b border-zinc-700">
        {/* Add Card Tab Button (no changes needed) */}
        <button
          className={`px-4 py-2 text-sm ${activeTab === 'addCard'
              ? 'border-b-2 border-blue-500 text-white'
              : 'text-zinc-400'
            }`}
          onClick={() => { setActiveTab('addCard'); }}
        >
          {cardToEdit ? 'Edit Card' : 'Add Card'}
        </button>
        {/* Test Tab Button (shows total card count) */}
        <button
          className={`px-4 py-2 text-sm ${activeTab === 'test'
              ? 'border-b-2 border-blue-500 text-white'
              : 'text-zinc-400'
            }`}
          onClick={() => setActiveTab('test')}
        >
          Test 
        </button>
        {/* Browse Cards Tab Button */}
        <button
          className={`px-4 py-2 text-sm ${activeTab === 'browseCards'
              ? 'border-b-2 border-blue-500 text-white'
              : 'text-zinc-400'
            }`}
          onClick={() => setActiveTab('browseCards')}
        >
          Cards ({cardCount})
        </button>
        <button
          className={`px-4 py-2 text-sm ${activeTab === 'importExport'
              ? 'border-b-2 border-blue-500 text-white'
              : 'text-zinc-400'
            }`}
          onClick={() => setActiveTab('importExport')}
        >
          Import/Export
        </button>
        {/* Help Button */}
        <button
          className={`ml-auto px-4 py-2 text-sm ${activeTab === 'help'
              ? 'border-b-2 border-blue-500 text-white'
              : 'text-zinc-400'
            }`}
          onClick={() => setActiveTab('help')}
        >
          Help
        </button>
      </div>

      {/* --- ADD CARD TAB --- */}
      {activeTab === 'addCard' && (<AddCardForm
        initialFrontText={frontText}
        initialHighlight={originalHighlight}
        initialPrefillData={initialPrefillData}
        onCardSaved={handleCardSaved}
        cardToEdit={cardToEdit}
      />)}

      {/* --- Test GAME TAB --- */}
      {activeTab === 'test' && (<TestPage />)}

      {/* --- NEW: ALL CARDS TAB --- */}
      {activeTab === 'browseCards' && (
        // We'll use your existing TestList component here
        <ReviewList onEditRequest={handleEditRequest} />
      )}

      {/* 6. NEW: IMPORT/EXPORT TAB CONTENT --- */}
      {activeTab === 'importExport' && (
        <ImportExport />
      )}

      {/* --- NEW: HELP TAB --- */}
      {activeTab === 'help' && (
        <HelpAndCredits />
      )}
    </main>
  );
}

export default App;