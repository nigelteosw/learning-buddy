import React, { useState, useEffect, useMemo } from 'react';
import { Card, db } from '@/lib/db';
import { updateCardSRS, ReviewQuality } from '@/lib/srs';
import { ClickableCard } from './ClickableCard'; // 1. Import ClickableCard

// Function to shuffle an array (Fisher-Yates)
function shuffleArray<T>(array: T[]): T[] {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
  return array;
}

// Enum for game states remains the same
enum GameState {
  NotStarted, Loading, Playing, Finished,
}

export function TestGame() {
  const [gameState, setGameState] = useState<GameState>(GameState.NotStarted);
  // Store ALL cards loaded initially to pick distractors
  const [allCards, setAllCards] = useState<Card[]>([]); 
  // Store the 5 cards for this specific session
  const [sessionCards, setSessionCards] = useState<Card[]>([]); 
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [sessionScore, setSessionScore] = useState(0);
  
  // New state for the quiz interaction
  const [quizOptions, setQuizOptions] = useState<string[]>([]); // Options for the current question
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null); // User's choice
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | null>(null); // Feedback state
  const [showNextButton, setShowNextButton] = useState(false); // Control when "Next" appears

  // --- Start Session Logic ---
  const handleStartSession = async () => {
    setGameState(GameState.Loading);
    const loadedCards = await db.cards.toArray();
    
    if (loadedCards.length < 4) { // Need at least 4 cards for 1 correct + 3 distractors
      setGameState(GameState.NotStarted);
      alert("You need at least 4 cards saved to start a quiz session!");
      return;
    }

    setAllCards(loadedCards); // Store all cards for generating options
    
    // Shuffle and pick 5 cards for the session
    const shuffled = shuffleArray([...loadedCards]);
    const sessionSubset = shuffled.slice(0, 5); // Limit to 5 questions
    
    setSessionCards(sessionSubset);
    setCurrentCardIndex(0);
    setSessionScore(0);
    setSelectedAnswer(null);
    setIsAnswerCorrect(null);
    setShowNextButton(false);
    setGameState(GameState.Playing);
  };

  // --- Generate Quiz Options ---
  // Memoize to prevent re-calculating options unnecessarily
  const currentCard = useMemo(() => {
    return sessionCards[currentCardIndex];
  }, [sessionCards, currentCardIndex]);

  useEffect(() => {
    if (gameState === GameState.Playing && currentCard && allCards.length > 0) {
      // 1. Get the correct answer
      const correctAnswer = currentCard.concept;
      
      // 2. Get 3 unique distractors (headings from other cards)
      const distractors = allCards
        .filter(card => card.id !== currentCard.id) // Exclude the current card
        .map(card => card.concept) // Get headings
        .filter((heading, index, self) => self.indexOf(heading) === index); // Unique headings
      
      const shuffledDistractors = shuffleArray(distractors).slice(0, 3);
      
      // 3. Combine and shuffle
      const options = shuffleArray([correctAnswer, ...shuffledDistractors]);
      setQuizOptions(options);
    }
  }, [currentCard, allCards, gameState]); // Re-run when card or game state changes


  // --- Handle User Answering ---
  const handleAnswerSelection = (selectedHeading: string) => {
    if (selectedAnswer !== null) return; // Already answered

    setSelectedAnswer(selectedHeading);
    const correct = selectedHeading === currentCard.concept;
    setIsAnswerCorrect(correct);
    setShowNextButton(true); // Show the "Next" button

    if (correct) {
      setSessionScore(prev => prev + 1);
    }
  };

  // --- Handle Moving to Next Question ---
  const handleNextQuestion = async () => {
    if (!currentCard) return;

    // Determine SRS quality based on correctness
    const quality: ReviewQuality = isAnswerCorrect ? 4 : 0; // Correct = Good, Incorrect = Again
    await updateCardSRS(currentCard, quality);

    // Move to next card or finish
    if (currentCardIndex < sessionCards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      // Reset state for the new card
      setSelectedAnswer(null);
      setIsAnswerCorrect(null);
      setShowNextButton(false);
      // isFlipped state is managed by ClickableCard now, no need to reset here
    } else {
      setGameState(GameState.Finished);
    }
  };

  // --- Reset to Start Screen ---
  const handleRestart = () => {
    setGameState(GameState.NotStarted);
  };

  // --- Render Logic ---

  if (gameState === GameState.Loading) {
    return <div className="text-center text-zinc-400">Loading cards...</div>;
  }

  if (gameState === GameState.NotStarted) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 pt-10">
        <h2 className="text-xl font-semibold text-white">Ready for a Quiz?</h2>
        <button 
          onClick={handleStartSession}
          className="rounded-lg bg-blue-600 px-6 py-3 text-lg font-semibold text-white transition-colors hover:bg-blue-500"
        >
          Start Quiz (5 Cards)
        </button>
      </div>
    );
  }

  if (gameState === GameState.Finished) {
    // Session finished screen (Score out of 5)
     return (
      <div className="text-center space-y-4">
        <h2 className="text-xl font-semibold text-white">Quiz Complete!</h2>
        <p className="text-lg font-medium text-green-400">
          Score: {sessionScore} / {sessionCards.length} 
        </p>
        <button 
          onClick={handleRestart} 
          className="rounded-md bg-zinc-600 px-4 py-2 text-white hover:bg-zinc-500"
        >
          Back to Start
        </button>
      </div>
    );
  }

  // --- Main Playing UI (gameState === GameState.Playing) ---
  if (!currentCard) {
     return <div className="text-center text-red-400">Error: No card to display.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="text-center text-sm text-zinc-400">
        Question {currentCardIndex + 1} of {sessionCards.length}
      </div>

      {/* --- Clickable Card Display --- */}
      {/* It manages its own isFlipped state */}
      <ClickableCard 
        description={currentCard.front} 
        explanation={currentCard.back} 
      />

      {/* --- Multiple Choice Options --- */}
      <div className="grid grid-cols-2 gap-2 pt-2">
        {quizOptions.map((option) => {
          // Determine button style based on selection and correctness
          let buttonClass = "rounded-md p-3 text-center transition-colors ";
          const isSelected = selectedAnswer === option;
          const isCorrectAnswer = option === currentCard.concept;

          if (selectedAnswer === null) {
            // Not answered yet
            buttonClass += "bg-zinc-700 text-white hover:bg-zinc-600";
          } else if (isSelected) {
            // This button was selected
            buttonClass += isAnswerCorrect ? "bg-green-600 text-white" : "bg-red-600 text-white";
          } else if (isCorrectAnswer) {
             // This is the correct answer, but wasn't selected (show correct)
             buttonClass += "bg-green-800 text-green-300 border border-green-600";
          }
           else {
            // Incorrect, unselected option
            buttonClass += "bg-zinc-800 text-zinc-500 cursor-not-allowed";
          }

          return (
            <button
              key={option}
              onClick={() => handleAnswerSelection(option)}
              disabled={selectedAnswer !== null} // Disable after answering
              className={buttonClass}
            >
              {option}
            </button>
          );
        })}
      </div>

      {/* --- Next Button --- */}
      {showNextButton && (
        <button
          onClick={handleNextQuestion}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500 mt-4"
        >
          Next Question
        </button>
      )}
    </div>
  );
}