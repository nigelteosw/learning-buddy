import React, { useState, useEffect } from 'react';
import { Card, db } from '@/lib/db'; // Import db directly
import { updateCardSRS, ReviewQuality } from '@/lib/srs'; // Keep SRS update logic

// Enum to manage game states
enum GameState {
  NotStarted, // Show "Start Session" button
  Loading,    // Loading cards
  Playing,    // Actively reviewing
  Finished,   // Session complete
}

export function ReviewGame() {
  const [gameState, setGameState] = useState<GameState>(GameState.NotStarted);
  const [sessionCards, setSessionCards] = useState<Card[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionScore, setSessionScore] = useState(0);
  const [cardsReviewedCount, setCardsReviewedCount] = useState(0);

  // --- Start Session Logic ---
  const handleStartSession = async () => {
    setGameState(GameState.Loading);
    
    // --- CHANGE: Load ALL cards instead of just due ones ---
    const allCards = await db.cards.toArray(); 
    // You could add filtering here later (e.g., specific tags, recent cards)
    
    if (allCards.length === 0) {
      setGameState(GameState.NotStarted); // Go back if no cards exist
      alert("You don't have any cards saved yet!");
      return;
    }
    
    // Shuffle the cards for the session
    setSessionCards(allCards.sort(() => Math.random() - 0.5)); 
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setSessionScore(0);
    setCardsReviewedCount(0);
    setGameState(GameState.Playing); // Start the game
  };

  // --- Game Logic (Flip, Feedback) - Largely unchanged ---
  const handleFlip = () => {
    setIsFlipped(true);
  };

  const handleFeedback = async (quality: ReviewQuality) => {
    const currentCard = sessionCards[currentCardIndex];
    if (!currentCard) return;

    // Update SRS data even in on-demand session
    await updateCardSRS(currentCard, quality); 

    if (quality >= 4) {
      setSessionScore(prev => prev + 1);
    }
    setCardsReviewedCount(prev => prev + 1);

    if (currentCardIndex < sessionCards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setIsFlipped(false);
    } else {
      setGameState(GameState.Finished); // Session over
    }
  };

  // --- Reset to Start Screen ---
  const handleRestart = () => {
    setGameState(GameState.NotStarted); 
  };

  // --- Render based on Game State ---

  if (gameState === GameState.Loading) {
    return <div className="text-center text-zinc-400">Loading cards...</div>;
  }

  // Initial screen with "Start" button
  if (gameState === GameState.NotStarted) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 pt-10">
        <h2 className="text-xl font-semibold text-white">Ready to Review?</h2>
        <button 
          onClick={handleStartSession}
          className="rounded-lg bg-blue-600 px-6 py-3 text-lg font-semibold text-white transition-colors hover:bg-blue-500"
        >
          Start Review Session
        </button>
        <p className="text-sm text-zinc-500">(Reviews all saved cards)</p>
      </div>
    );
  }

  // Session finished screen
  if (gameState === GameState.Finished) {
    return (
      <div className="text-center space-y-4">
        <h2 className="text-xl font-semibold text-white">Review Complete!</h2>
        <p className="text-zinc-300">
          You reviewed {cardsReviewedCount} cards.
        </p>
        <p className="text-lg font-medium text-green-400">
          Score: {sessionScore} / {cardsReviewedCount}
        </p>
        <button 
          onClick={handleRestart} // Go back to start screen
          className="rounded-md bg-zinc-600 px-4 py-2 text-white hover:bg-zinc-500"
        >
          Back to Start
        </button>
      </div>
    );
  }

  // --- Main Playing UI (gameState === GameState.Playing) ---
  // (Error check just in case)
  if (sessionCards.length === 0 || currentCardIndex >= sessionCards.length) {
     return <div className="text-center text-red-400">Error: No card to display.</div>;
  }
  const currentCard = sessionCards[currentCardIndex];

  return (
    <div className="space-y-4">
      <div className="text-center text-sm text-zinc-400">
        Card {currentCardIndex + 1} of {sessionCards.length}
      </div>
      
      {/* Card Display */}
      <div className="min-h-[200px] rounded-lg border border-zinc-700 bg-zinc-800 p-4 flex flex-col justify-center items-center text-center">
        <h3 className="mb-2 text-lg font-semibold text-blue-400">{currentCard.concept}</h3> {/* Ensure Card interface uses 'heading' */}
        
        {!isFlipped ? (
          <p className="text-xl text-white">{currentCard.front}</p>
        ) : (
          <p className="text-lg text-zinc-200 whitespace-pre-wrap">{currentCard.back}</p>
        )}
      </div>

      {/* Action Buttons */}
      {!isFlipped ? (
        <button 
          onClick={handleFlip}
          className="w-full rounded-lg bg-zinc-700 px-4 py-2 font-semibold text-white hover:bg-zinc-600"
        >
          Flip Card
        </button>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          <button onClick={() => handleFeedback(0)} className="rounded bg-red-600 p-2 text-white hover:bg-red-500">Again</button>
          <button onClick={() => handleFeedback(3)} className="rounded bg-orange-500 p-2 text-white hover:bg-orange-400">Hard</button>
          <button onClick={() => handleFeedback(4)} className="rounded bg-green-600 p-2 text-white hover:bg-green-500">Good</button>
          <button onClick={() => handleFeedback(5)} className="rounded bg-blue-500 p-2 text-white hover:bg-blue-400">Easy</button>
        </div>
      )}
    </div>
  );
}