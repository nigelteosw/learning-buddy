import React, { useState, useEffect } from 'react';
import { db, Card } from '@/lib/db';

type AddCardFormProps = {
  initialFrontText: string;
  initialHighlight: string;
  onCardSaved: () => void;
  cardToEdit: Card | null; // 1. ADD THIS PROP
};

export function AddCardForm({
  initialFrontText,
  initialHighlight,
  onCardSaved,
  cardToEdit, // 2. GET THE PROP
}: AddCardFormProps) {
  const [frontText, setFrontText] = useState('');
  const [backText, setBackText] = useState('');
  const [concept, setConcept] = useState('');

  // 3. Update the effect to handle editing OR highlighting
  useEffect(() => {
    if (cardToEdit) {
      // We are editing a card, so fill all fields
      setConcept(cardToEdit.concept);
      setFrontText(cardToEdit.front);
      setBackText(cardToEdit.back);
    } else {
      // We are adding a new card, just use the highlight
      setFrontText(initialFrontText);
      setConcept('');
      setBackText('');
    }
  }, [cardToEdit, initialFrontText]); // Re-run if either changes

  const handleSaveCard = async () => {
    if (!concept || !frontText || !backText) {
      alert('Please fill out all fields.');
      return;
    }

    try {
      // 4. Check if we are editing or adding
      if (cardToEdit) {
        // We are EDITING
        await db.cards.update(cardToEdit.id!, {
          concept: concept,
          front: frontText,
          back: backText,
        });
        alert('Card updated!');
      } else {
        // We are ADDING a new card
        const newCard: Card = {
          concept: concept,
          front: frontText,
          back: backText,
          createdAt: new Date(),
          dueDate: new Date(),
          interval: 1,
          easeFactor: 2.5,
        };
        await db.cards.add(newCard);
        alert('Card saved!');
      }
      
      onCardSaved(); // Tell App.tsx we are done
    } catch (e) {
      console.error('Failed to save card:', e);
      alert('Failed to save card.');
    }
  };

  // 5. Change button text based on mode
  const buttonText = cardToEdit ? 'Update Card' : 'Save Card';
  const buttonColor = cardToEdit
    ? 'bg-blue-600 hover:bg-blue-500'
    : 'bg-green-600 hover:bg-green-500';

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-zinc-700 p-3">
        {/* ... (Heading, Front Text, Back Text inputs are the same) ... */}
        {/* --- Card Heading --- */}
        <div>
          <label htmlFor="heading" className="mb-1 block text-sm font-medium text-zinc-400">Heading</label>
          <input type="text" id="heading" value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="e.g., 'Kalman Filters'" className="block w-full rounded-md border-zinc-600 bg-zinc-800 p-2 text-white placeholder-zinc-500" />
        </div>
        
        {/* --- Card Front (Original Text) --- */}
        <div>
          <label htmlFor="frontText" className="mb-1 block text-sm font-medium text-zinc-400">Original Text (Front)</label>
          {initialHighlight && !cardToEdit && (
            <p className="mb-2 text-xs text-zinc-500">
              Pre-filled from highlight. You can edit if needed.
            </p>
          )}
          <textarea id="frontText" value={frontText} onChange={(e) => setFrontText(e.target.value)} rows={5} placeholder="Type the original concept or text here..." className="block w-full rounded-md border-zinc-600 bg-zinc-800 p-2 text-white placeholder-zinc-500" />
        </div>

        {/* --- Card Back (Explanation) --- */}
        <div>
          <label htmlFor="backText" className="mb-1 block text-sm font-medium text-zinc-400">Explanation (Back)</label>
          <textarea id="backText" value={backText} onChange={(e) => setBackText(e.target.value)} rows={5} placeholder="Type your explanation or notes here..." className="block w-full rounded-md border-zinc-600 bg-zinc-800 p-2 text-white placeholder-zinc-500" />
        </div>
        
        {/* --- Save Button --- */}
        <button
          onClick={handleSaveCard}
          className={`w-full rounded-lg px-3 py-2 font-semibold text-white transition-colors ${buttonColor}`}
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
}