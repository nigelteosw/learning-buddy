import React, { useState, useCallback, useMemo } from "react";
import { db, Card, getPaginatedCards } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { parseQuiz, ParsedQuiz } from "./QuizView";
import { promptClient } from "@/lib/modelClients/promptClient";
import { ReviewListItem } from "./ReviewListItem";
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
      {sortedCards.map(card => (
        <ReviewListItem
          key={card.id}
          card={card}
          isOpen={openCardId === card.id}
          isQuizzing={quizzingCardId === card.id}
          quizData={quiz}
          isQuizLoading={isLoading}
          quizError={error}
          onToggle={(isOpen) => {
            if (isOpen) {
              setOpenCardId(card.id ?? null);
              resetQuizState();
            } else if (openCardId === card.id) { // It's being closed
              setOpenCardId(null);
              resetQuizState();
            }
          }}
          onEditRequest={onEditRequest}
          onDeleteCard={handleDeleteCard}
          onGenerateQuiz={handleGenerateQuiz}
          onResetQuiz={resetQuizState}
        />
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
