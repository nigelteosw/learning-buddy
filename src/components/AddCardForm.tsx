import React, { useState, useEffect } from 'react';
import { db, Card } from '@/lib/db';

type AddCardFormProps = {
  initialFrontText: string;
  initialHighlight: string;
  initialPrefillData: { heading: string; back: string } | null;
  onCardSaved: () => void;
  cardToEdit: Card | null;
};

export function AddCardForm({
  initialFrontText,
  initialHighlight,
  initialPrefillData,
  onCardSaved,
  cardToEdit,
}: AddCardFormProps) {
  const [frontText, setFrontText] = useState('');
  const [backText, setBackText] = useState('');
  const [heading, setHeading] = useState(''); // Correct state name
  const [tags, setTags] = useState(''); // State for tags as a comma-separated string

  useEffect(() => {
    if (cardToEdit) {
      // EDIT MODE: load the existing card
      setHeading(cardToEdit.concept ?? ''); // Use heading field from Card
      setFrontText(cardToEdit.front ?? '');
      setBackText(cardToEdit.back ?? '');
      setTags(cardToEdit.tags?.join(', ') ?? ''); // Join array to string for input
    } else if (initialPrefillData) {
      // PREFILL MODE: Coming from floating panel
      setHeading('');
      setFrontText(initialPrefillData.heading || ''); // Use initialFrontText passed from App
      setBackText(initialPrefillData.back || '');
      setTags('');
    } else {
      // ADD MODE: Coming from direct highlight or manual entry
      setFrontText(initialFrontText || initialHighlight || '');
      setBackText('');
      setHeading('');
    }
  }, [
    cardToEdit,
    initialFrontText,
    initialHighlight,
    initialPrefillData,
  ]);

  // --- THIS FUNCTION IS FIXED ---
  const handleSaveCard = async () => {
    // Use 'heading' state variable
    if (!heading || !frontText || !backText) {
      alert('Please fill out all fields.');
      return;
    }

    // Convert comma-separated string to a clean array of tags
    const tagsArray = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);

    try {
      if (cardToEdit) {
        // UPDATE EXISTING CARD
        await db.cards.update(cardToEdit.id!, {
          concept: heading, // FIX: Use heading state
          front: frontText,
          back: backText,
          tags: tagsArray,
        });
        alert('Card updated!');
      } else {
        // CREATE NEW CARD
        const newCard: Card = {
          concept: heading, // FIX: Use heading state
          front: frontText,
          back: backText,
          createdAt: new Date(),
          dueDate: new Date(),
          interval: 1,
          easeFactor: 2.5,
          tags: tagsArray,
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
  // --- END OF FIX ---


  const buttonText = cardToEdit ? 'Update Card' : 'Save Card';
  const buttonColor = cardToEdit
    ? 'bg-blue-600 hover:bg-blue-500'
    : 'bg-green-600 hover:bg-green-500';

  // --- JSX (ensure input uses 'heading' state) ---
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-zinc-700 p-3">
        {/* Heading / Concept */}
        <div>
          <label
            htmlFor="heading"
            className="mb-1 block text-sm font-medium text-zinc-400"
          >
            Concept
          </label>
          <input
            id="heading"
            type="text"
            value={heading} // Correctly uses heading state
            onChange={(e) => setHeading(e.target.value)} // Correctly uses setHeading
            placeholder="e.g., 'Kalman Filters'"
            className="block w-full rounded-md border border-zinc-600 bg-zinc-800 p-2 text-white placeholder-zinc-500"
          />
        </div>

        {/* Tags Input */}
        {/* <div>
          <label
            htmlFor="tags"
            className="mb-1 block text-sm font-medium text-zinc-400"
          >
            Tags (comma-separated)
          </label>
          <input
            id="tags"
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g., programming, javascript, react"
            className="block w-full rounded-md border border-zinc-600 bg-zinc-800 p-2 text-white placeholder-zinc-500"
          />
        </div> */}

        {/* ... (Rest of JSX is likely correct) ... */}
         {/* Front */}
        <div>
          <label
            htmlFor="frontText"
            className="mb-1 block text-sm font-medium text-zinc-400"
          >
            Short Summary (Front)
          </label>
          {!cardToEdit && (initialHighlight || initialPrefillData) && (
             <p className="mb-2 text-xs text-zinc-500">
               Pre-filled. You can edit it.
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