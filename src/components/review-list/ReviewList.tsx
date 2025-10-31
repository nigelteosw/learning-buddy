import React, { useState, useCallback, useMemo } from "react";
import { db, Card, getPaginatedCards } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { QuizView, parseQuiz, ParsedQuiz } from "./QuizView";
import { promptClient } from "@/lib/modelClients/promptClient";
import { ReviewListControls } from "./ReviewListControls";

type ReviewListProps = {
  onEditRequest: (card: Card) => void;
};

export function ReviewList({ onEditRequest }: ReviewListProps) {
  const [openCardId, setOpenCardId] = useState<number | null>(null);
  const [quizzingCardId, setQuizzingCardId] = useState<number | null>(null);

  // State lifted from QuizView
  const [quiz, setQuiz] = useState<ParsedQuiz | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State for searching and sorting
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("concept");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // The database query now uses our paginated function
  const paginatedData = useLiveQuery(
    () =>
      getPaginatedCards({
        page: currentPage,
        limit: itemsPerPage,
        sortBy: sortBy.replace(/_asc|_desc/g, ''), // Dexie's sortBy uses the key name
        searchTerm,
      }),
    [currentPage, sortBy, searchTerm], // Dependencies for the live query
    { cards: [], totalCount: 0 } // Initial value
  );

  const cards = paginatedData?.cards ?? [];
  const totalCount = paginatedData?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / itemsPerPage);


  // The delete logic also lives here
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

  const handleGenerateQuiz = useCallback(async (card: Card) => {
    setQuizzingCardId(card.id ?? null);
    setIsLoading(true);
    setError(null);
    setQuiz(null);

    try {
      await promptClient.initFromUserGesture();
      const stream = await promptClient.generateQuizStream(
        `${card.front}\n\n${card.back}`
      );
      let fullText = "";
      for await (const chunk of stream) {
        fullText += chunk;
      }
      const parsed = parseQuiz(fullText);
      if (parsed) {
        setQuiz(parsed);
      } else {
        setError("Failed to generate a valid quiz. Please try again.");
      }
    } catch (e) {
      console.error("Quiz generation failed:", e);
      setError("An error occurred while generating the quiz.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resetQuizState = () => {
    setQuizzingCardId(null);
    setQuiz(null);
  };

  // Effect to reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortBy]);

  // Sort logic is now applied within the DB query, but we need to handle reverse for 'desc'
  const sortedCards = useMemo(() => {
    if (sortBy.endsWith('_desc')) {
      // The DB query already sorted it ascending, so we just reverse the final page.
      return [...cards].reverse();
    }
    return cards;
  }, [cards, sortBy]);

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold text-white">Review Cards</h2>

      <ReviewListControls
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        sortBy={sortBy}
        onSortByChange={setSortBy}
      />

      {totalCount > 0 && (
        <p className="text-sm text-zinc-400">
          Showing {cards.length} of {totalCount} cards.
        </p>
      )}

      {totalCount === 0 && (
        <p className="text-zinc-400">You haven't saved any cards yet.</p>
      )}
      {sortedCards.map((card) => (
        <details
          key={card.id}
          open={openCardId === card.id}
          onToggle={(e) => {
            if ((e.target as HTMLDetailsElement).open) {
              setOpenCardId(card.id ?? null);
              resetQuizState();
            } else if (openCardId === card.id) {
              setOpenCardId(null);
              resetQuizState();
            }
          }}
          className="group rounded-lg border border-zinc-700 bg-zinc-800 p-3"
        >
          <summary className="flex cursor-pointer items-center justify-between font-semibold text-blue-400">
            {card.concept}

            <div className="flex items-center space-x-2">
              {/* --- RESET BUTTON --- */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  resetQuizState();
                }}
                className="p-1.5 rounded-md transition
    text-zinc-500 hover:text-yellow-400
    hover:bg-zinc-800/40 active:scale-95"
                title="Reset"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4"
                >
                  <path d="M3 3v6h6" />
                  <path d="M3.51 9A9 9 0 1 1 9 20.49" />
                </svg>
              </button>

              {/* --- EDIT BUTTON --- */}
              <button
                onClick={() => onEditRequest(card)}
                className="p-1 text-zinc-500 hover:text-green-400"
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
              <h4 className="font-medium text-zinc-400">Summary</h4>
              <p
                className={`mt-1 text-zinc-100 transition-all ${quizzingCardId === card.id
                    ? "cursor-pointer blur-sm hover:blur-none"
                    : ""
                  }`}
              >
                {card.front}
              </p>
            </div>
            <div>
              <h4 className="font-medium text-zinc-400">Explanation</h4>
              <p
                className={`mt-1 text-zinc-100 transition-all ${quizzingCardId === card.id
                    ? "cursor-pointer blur-sm hover:blur-none"
                    : ""
                  }`}
              >
                {card.back}
              </p>
            </div>
            {/* Tags Display */}
            {card.tags && card.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 py-2">
                {card.tags.map((tag, index) => (
                  <span key={index} className="rounded-md bg-zinc-700 px-2.5 py-0.5 text-xs font-medium text-zinc-300">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            <QuizView
              card={card}
              quiz={quizzingCardId === card.id ? quiz : null}
              isLoading={quizzingCardId === card.id ? isLoading : false}
              error={quizzingCardId === card.id ? error : null}
              onGenerate={() => handleGenerateQuiz(card)}
            />
          </div>
        </details>
      ))}

      {/* --- PAGINATION CONTROLS --- */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2 pt-4">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="rounded-md bg-zinc-700 px-3 py-1 text-sm text-white hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${currentPage === page
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }`}
            >
              {page}
            </button>
          ))}
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="rounded-md bg-zinc-700 px-3 py-1 text-sm text-white hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
        </div>
      )}
    </div>
  );
}
