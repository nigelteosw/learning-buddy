import React, { useState } from 'react';

// Props the card will accept
type ClickableCardProps = {
  description: string; // Text for the front (without the heading)
  explanation: string; // Text for the back (full explanation)
};

export function ClickableCard({ description, explanation }: ClickableCardProps) {
  // State to track if the card is flipped
  const [isFlipped, setIsFlipped] = useState(false);

  // Function to toggle the flipped state
  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  return (
    <div
      onClick={handleFlip} // Make the whole div clickable
      className="min-h-[150px] cursor-pointer rounded-lg border border-zinc-700 bg-zinc-800 p-4 transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98]"
      style={{ perspective: '1000px' }} // Needed for potential 3D flip effect later
    >
      {/* Basic transition for flipping content */}
      <div
        className={`transition-opacity duration-300 ${
          isFlipped ? 'opacity-100' : 'opacity-100'
        }`} // Simple fade for now
      >
        {!isFlipped ? (
          // --- FRONT ---
          <div className="flex flex-col items-center justify-center text-center">
            <p className="text-lg text-white">{description}</p>
            <span className="mt-4 text-xs text-zinc-500">(Click to reveal explanation)</span>
          </div>
        ) : (
          // --- BACK ---
          <div className="text-left">
            <p className="text-base text-zinc-200 whitespace-pre-wrap">
              {explanation}
            </p>
            <span className="mt-4 block text-center text-xs text-zinc-500">(Click to hide)</span>
          </div>
        )}
      </div>
    </div>
  );
}