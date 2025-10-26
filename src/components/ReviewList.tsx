import React from "react";
import { db, Card } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";


type ReviewListProps = {
  onEditRequest: (card: Card) => void;
};

export function ReviewList({ onEditRequest }: ReviewListProps) {
  // 1. The database query now lives inside this component
  const allCards = useLiveQuery(() => db.cards.orderBy("concept").toArray());

  // 2. The delete logic also lives here
  const handleDeleteCard = async (id: number) => {
    if (confirm("Are you sure you want to delete this card?")) {
      try {
        await db.cards.delete(id);
      } catch (e) {
        console.error("Failed to delete card:", e);
        alert("Failed to delete card.");
      }
    }
  };

  // 3. The JSX is updated
  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold text-white">Review Cards</h2>
      {(!allCards || allCards.length === 0) && (
        <p className="text-zinc-400">You haven't saved any cards yet.</p>
      )}
      {allCards?.map((card) => (
        <details
          key={card.id}
          className="group rounded-lg border border-zinc-700 bg-zinc-800 p-3"
        >
          <summary className="flex cursor-pointer items-center justify-between font-semibold text-blue-400">
            {card.concept}

            {/* 3. Add a div to hold both buttons */}
            <div className="flex items-center space-x-2">
              {/* --- EDIT BUTTON --- */}
              <button
                onClick={() => onEditRequest(card)}
                className="p-1 text-zinc-500 hover:text-green-400"
                onClickCapture={(e) => e.preventDefault()}
                title="Edit card"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                  />
                </svg>
              </button>

              {/* --- DELETE BUTTON --- */}
              <button
                onClick={() => handleDeleteCard(card.id!)}
                className="p-1 text-zinc-500 hover:text-red-400"
                onClickCapture={(e) => e.preventDefault()}
                title="Delete card"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12.977 0a48.108 48.108 0 0 1-3.478-.397m16.455 0A2.25 2.25 0 0 0 16.5 5.25h-9a2.25 2.25 0 0 0-2.19.25m15.3 0V8.25m-15.3 0V8.25m15.3 0V6a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 3.75 6v2.25m15.3 0h-15.3"
                  />
                </svg>
              </button>
            </div>
          </summary>
          <div className="mt-2 space-y-2 border-t border-zinc-700 pt-2">
            <div>
              <h4 className="font-medium text-zinc-400">Original Text</h4>
              <p className="mt-1 text-zinc-100">{card.front}</p>
            </div>
            <div>
              <h4 className="font-medium text-zinc-400">Explanation</h4>
              <p className="mt-1 text-zinc-100">{card.back}</p>
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
