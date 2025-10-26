import React, { useState, useEffect } from 'react';
import { db, Card } from '@/lib/db';

type AddCardFormProps = {
  initialFrontText: string;
  initialHighlight: string;
  initialBackText: string; // explanation from panel
  onCardSaved: () => void;
  cardToEdit: Card | null;
};

export function AddCardForm({
  initialFrontText,
  initialHighlight,
  initialBackText,
  onCardSaved,
  cardToEdit,
}: AddCardFormProps) {
  const [frontText, setFrontText] = useState('');
  const [backText, setBackText] = useState('');
  const [concept, setConcept] = useState('');

  // hydrate form values anytime we:
  // - switch into edit mode for a card
  // - or receive new data from the floating panel (front/back text)
  useEffect(() => {
    if (cardToEdit) {
      // EDIT MODE: load the existing card
      setConcept(cardToEdit.concept ?? '');
      setFrontText(cardToEdit.front ?? '');
      setBackText(cardToEdit.back ?? '');
    } else {
      // ADD MODE: coming from highlight + AI explanation
      // Fill the "Original Text (Front)" with highlight or summary
      setFrontText(initialFrontText || initialHighlight || '');
      // Fill the "Explanation (Back)" with the AI explanation
      setBackText(initialBackText || '');
      // Heading/Concept starts empty for new cards
      setConcept('');
    }
  }, [
    cardToEdit,
    initialFrontText,
    initialHighlight,
    initialBackText, // ✅ include this so it updates when you click Add again
  ]);

  const handleSaveCard = async () => {
    if (!concept || !frontText || !backText) {
      alert('Please fill out all fields.');
      return;
    }

    try {
      if (cardToEdit) {
        // UPDATE EXISTING CARD
        await db.cards.update(cardToEdit.id!, {
          concept,
          front: frontText,
          back: backText,
        });
        alert('Card updated!');
      } else {
        // CREATE NEW CARD
        const newCard: Card = {
          concept,
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

      onCardSaved();
    } catch (e) {
      console.error('Failed to save card:', e);
      alert('Failed to save card.');
    }
  };

  const buttonText = cardToEdit ? 'Update Card' : 'Save Card';
  const buttonColor = cardToEdit
    ? 'bg-blue-600 hover:bg-blue-500'
    : 'bg-green-600 hover:bg-green-500';

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-zinc-700 p-3">
        {/* Heading / Concept */}
        <div>
          <label
            htmlFor="heading"
            className="mb-1 block text-sm font-medium text-zinc-400"
          >
            Heading
          </label>
          <input
            id="heading"
            type="text"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            placeholder="e.g., 'Kalman Filters'"
            className="block w-full rounded-md border border-zinc-600 bg-zinc-800 p-2 text-white placeholder-zinc-500"
          />
        </div>

        {/* Front */}
        <div>
          <label
            htmlFor="frontText"
            className="mb-1 block text-sm font-medium text-zinc-400"
          >
            Original Text (Front)
          </label>

          {!cardToEdit && initialHighlight && (
            <p className="mb-2 text-xs text-zinc-500">
              Pre-filled from highlight. You can edit it.
            </p>
          )}

          <textarea
            id="frontText"
            value={frontText}
            onChange={(e) => setFrontText(e.target.value)}
            rows={5}
            placeholder="Type the original concept or text here..."
            className="block w-full rounded-md border border-zinc-600 bg-zinc-800 p-2 text-white placeholder-zinc-500"
          />
        </div>

        {/* Back */}
        <div>
          <label
            htmlFor="backText"
            className="mb-1 block text-sm font-medium text-zinc-400"
          >
            Explanation (Back)
          </label>
          <textarea
            id="backText"
            value={backText}
            onChange={(e) => setBackText(e.target.value)}
            rows={5}
            placeholder="Type your explanation or notes here..."
            className="block w-full rounded-md border border-zinc-600 bg-zinc-800 p-2 text-white placeholder-zinc-500"
          />
        </div>

        {/* Save */}
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
