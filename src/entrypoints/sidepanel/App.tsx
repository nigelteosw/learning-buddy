import React, { useState, useEffect } from 'react';
import { db, Card } from '@/lib/db'; // 1. Import Card type
import { useLiveQuery } from 'dexie-react-hooks';
import { AddCardForm } from '@/components/AddCardForm';
import { ReviewList } from '@/components/ReviewList';

function App() {
  const [frontText, setFrontText] = useState('');
  // REMOVED: const [backText, setBackText] = useState(''); // State is now in AddCardForm
  const [originalHighlight, setOriginalHighlight] = useState('');
  const [activeTab, setActiveTab] = useState<'addCard' | 'review'>('addCard');
  const [cardToEdit, setCardToEdit] = useState<Card | null>(null);

  // State to hold prefill data from the floating panel
  const [initialPrefillData, setInitialPrefillData] = useState<{ heading: string; back: string } | null>(null);

  const cardCount = useLiveQuery(() => db.cards.count(), [], 0);

  // Update message listener
  useEffect(() => {
    const messageListener = (message: any) => {
      console.log('App received message:', message);

      // Handles highlight coming *directly* from content script (if you still have that flow)
      if (message.type === 'explain-text' && message.text) {
        console.log('App received explain-text:', message.text);
        setOriginalHighlight(message.text);
        setFrontText(message.text);
        setCardToEdit(null);
        setInitialPrefillData(null); // Clear prefill if new highlight comes
        setActiveTab('addCard');
      }

      // Handles 'show-review' from popup
      if (message.type === 'show-review') {
        console.log('App received show-review');
        setActiveTab('review');
      }

      // --- ADDED: Handles prefill data forwarded from background script ---
      if (message.type === 'prefill-data' && message.data) {
        console.log('App received prefill-data:', message.data);
        setFrontText(message.data.front);         // Set front text for the form
        setOriginalHighlight(message.data.front); // Set the original highlight context
        setCardToEdit(null);                      // Ensure not in edit mode
        setInitialPrefillData({                   // Set initial heading and back
            heading: message.data.heading,
            back: message.data.back
        });
        setActiveTab('addCard');                  // Switch to the form
      }
      // --- END OF ADDITION ---
    };

    browser.runtime.onMessage.addListener(messageListener);
    return () => {
      browser.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  // Update this callback to ALSO clear 'cardToEdit' and 'initialPrefillData'
  const handleCardSaved = () => {
    setOriginalHighlight('');
    setFrontText('');
    setInitialPrefillData(null); // Clear prefill data after save/update
    setCardToEdit(null);
    setActiveTab('review');
  };

  // Handler for when 'Edit' is clicked (Unchanged)
  const handleEditRequest = (card: Card) => {
    setCardToEdit(card);
    setInitialPrefillData(null); // Clear any prefill data when editing
    setActiveTab('addCard'); 
  };

  return (
    <main className="min-h-screen space-y-4 bg-zinc-900 p-4 font-sans text-white">
      {/* --- TABS --- */}
      <div className="flex border-b border-zinc-700">
        <button
          className={`px-4 py-2 text-sm ${
            activeTab === 'addCard'
              ? 'border-b-2 border-blue-500 text-white'
              : 'text-zinc-400'
          }`}
          onClick={() => {
            setCardToEdit(null);
            setFrontText('');
            setOriginalHighlight('');
            setInitialPrefillData(null); // Clear prefill when switching manually
            setActiveTab('addCard');
          }}
        >
          {cardToEdit ? 'Edit Card' : 'Add Card'}
        </button>
        <button
           className={`px-4 py-2 text-sm ${
            activeTab === 'review'
              ? 'border-b-2 border-blue-500 text-white'
              : 'text-zinc-400'
          }`}
          onClick={() => setActiveTab('review')}
        >
          Review ({cardCount})
        </button>
      </div>

      {/* --- ADD CARD TAB --- */}
      {activeTab === 'addCard' && (
        <AddCardForm
          initialFrontText={frontText}
          initialHighlight={originalHighlight}
          // Pass the prefill data down
          initialPrefillData={initialPrefillData}
          onCardSaved={handleCardSaved}
          cardToEdit={cardToEdit}
        />
      )}

      {/* --- REVIEW TAB --- */}
      {activeTab === 'review' && (
        <ReviewList onEditRequest={handleEditRequest} />
      )}
    </main>
  );
}

export default App;