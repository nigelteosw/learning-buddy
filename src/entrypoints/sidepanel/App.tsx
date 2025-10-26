import React, { useState, useEffect } from 'react';
import { db, Card } from '@/lib/db'; // 1. Import Card type
import { useLiveQuery } from 'dexie-react-hooks';
import { AddCardForm } from '@/components/AddCardForm';
import { ReviewList } from '@/components/ReviewList';

function App() {
  const [frontText, setFrontText] = useState('');
  const [originalHighlight, setOriginalHighlight] = useState('');
  const [activeTab, setActiveTab] = useState<'addCard' | 'review'>('addCard');
  
  // 2. Add state to hold the card being edited
  const [cardToEdit, setCardToEdit] = useState<Card | null>(null);

  const cardCount = useLiveQuery(() => db.cards.count(), [], 0);

  // 3. Update message listener to clear 'cardToEdit'
  useEffect(() => {
    const messageListener = (message: any) => {
      if (message.type === 'explain-text' && message.text) {
        setOriginalHighlight(message.text);
        setFrontText(message.text);
        setCardToEdit(null); // Clear any active edit
        setActiveTab('addCard');
      }
    };
    browser.runtime.onMessage.addListener(messageListener);
    return () => {
      browser.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  // 4. Update this callback to ALSO clear 'cardToEdit'
  const handleCardSaved = () => {
    setOriginalHighlight('');
    setFrontText('');
    setCardToEdit(null); // Clear the edited card
    setActiveTab('review');
  };
  
  // 5. Create a handler for when 'Edit' is clicked
  const handleEditRequest = (card: Card) => {
    setCardToEdit(card);
    setActiveTab('addCard'); // Switch to the form
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
            setCardToEdit(null); // Clear edit mode if tab is clicked
            setFrontText(''); // Clear highlight
            setOriginalHighlight('');
            setActiveTab('addCard');
          }}
        >
          {/* Change tab text based on mode */}
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
          onCardSaved={handleCardSaved}
          cardToEdit={cardToEdit} // 6. Pass the card to the form
        />
      )}

      {/* --- REVIEW TAB --- */}
      {activeTab === 'review' && (
        // 7. Pass the edit handler to the list
        <ReviewList onEditRequest={handleEditRequest} />
      )}
    </main>
  );
}

export default App;