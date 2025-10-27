import React, { useState, useEffect } from 'react';
import { db, Card } from '@/lib/db'; // 1. Import Card type
import { useLiveQuery } from 'dexie-react-hooks';
import { AddCardForm } from '@/components/AddCardForm';
import { ReviewList } from '@/components/ReviewList'; // Remove this
import { ReviewGame } from '@/components/ReviewGame'; // Keep this

function App() {
  const [frontText, setFrontText] = useState('');
  const [originalHighlight, setOriginalHighlight] = useState('');
  const [activeTab, setActiveTab] = useState<'addCard' | 'review' | 'browseCards'>('addCard');
  const [cardToEdit, setCardToEdit] = useState<Card | null>(null);
  const [initialPrefillData, setInitialPrefillData] = useState<{ heading: string; back: string } | null>(null);

  // Keep count for the tab button
  const cardCount = useLiveQuery(() => db.cards.count(), [], 0);

  // Message listener (no changes needed here)
  useEffect(() => {
    const messageListener = (message: any) => {
      // ... (handles 'explain-text', 'show-review', 'prefill-data')
      if (message.type === 'explain-text' && message.text) {
        console.log('App received explain-text:', message.text);
        setOriginalHighlight(message.text);
        setFrontText(message.text);
        setCardToEdit(null);
        setInitialPrefillData(null);
        setActiveTab('addCard');
      }
      if (message.type === 'show-review') {
        console.log('App received show-review');
        setActiveTab('review');
      }
      if (message.type === 'prefill-data' && message.data) {
        console.log('App received prefill-data:', message.data);
        setFrontText(message.data.front);
        setOriginalHighlight(message.data.front);
        setCardToEdit(null);
        setInitialPrefillData({
          heading: message.data.heading,
          back: message.data.back
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
    setActiveTab('review'); // Switch to review after save might be desired
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
          onClick={() => { /* ... reset state ... */ setActiveTab('addCard'); }}
        >
          {cardToEdit ? 'Edit Card' : 'Add Card'}
        </button>
        {/* Review Tab Button (shows total card count) */}
        <button
          className={`px-4 py-2 text-sm ${activeTab === 'review'
              ? 'border-b-2 border-blue-500 text-white'
              : 'text-zinc-400'
            }`}
          onClick={() => setActiveTab('review')}
        >
          Review 
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
      </div>

      {/* --- ADD CARD TAB --- */}
      {activeTab === 'addCard' && (<AddCardForm
        initialFrontText={frontText}
        initialHighlight={originalHighlight}
        initialPrefillData={initialPrefillData}
        onCardSaved={handleCardSaved}
        cardToEdit={cardToEdit}
      />)}

      {/* --- REVIEW GAME TAB --- */}
      {activeTab === 'review' && (<ReviewGame />)}

      {/* --- NEW: ALL CARDS TAB --- */}
      {activeTab === 'browseCards' && (
        // We'll use your existing ReviewList component here
        <ReviewList onEditRequest={handleEditRequest} />
      )}
    </main>
  );
}

export default App;