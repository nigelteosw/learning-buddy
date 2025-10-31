import React, { useState, useEffect, useRef } from "react";
import { Card, db, TestSession } from "@/lib/db";
import { promptClient } from "@/lib/modelClients/promptClient";
import { updateCardSRS, ReviewQuality } from "@/lib/srs";

// Function to shuffle an array (Fisher-Yates)
function shuffleArray<T>(array: T[]): T[] {
  let currentIndex = array.length,
    randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }
  return array;
}

// Enum for game states remains the same
enum GameState {
  NotStarted,
  Loading,
  Playing,
  Finished,
}

export function TestGame() {
  const questionIdRef = useRef(0);
  const [gameState, setGameState] = useState<GameState>(GameState.NotStarted);
  // Store the 5 cards for this specific session
  const [sessionCards, setSessionCards] = useState<Card[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [sessionScore, setSessionScore] = useState(0);
  const [quizSize, setQuizSize] = useState<number | "all">(5);
  const [questionLoading, setQuestionLoading] = useState(false);

  // New state for the quiz interaction
  const [quizStatement, setQuizStatement] = useState<string>(""); // The T/F statement
  const [isStatementTrue, setIsStatementTrue] = useState<boolean>(false); // The ground truth for the statement
  const [selectedAnswer, setSelectedAnswer] = useState<boolean | null>(null); // User's choice: true or false
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | null>(null); // Feedback state
  const [showNextButton, setShowNextButton] = useState(false); // Control when "Next" appears

  // --- Start Session Logic ---
  const handleStartSession = async (size: number | "all") => {
    try {
      await promptClient.initFromUserGesture(); // <-- do this on a click
    } catch (e) {
      alert("Model not ready in this context. Try clicking Start again.");
      return;
    }

    setGameState(GameState.Loading);
    const loadedCards = await db.cards.toArray();

    if (loadedCards.length < 1) {
      setGameState(GameState.NotStarted);
      alert("You need at least 1 card saved to start a quiz session!");
      return;
    }

    // Shuffle and pick 5 cards for the session
    const shuffled = shuffleArray([...loadedCards]);
    const sessionSubset =
      size === "all" ? shuffled : shuffled.slice(0, size);

    setSessionCards(sessionSubset);
    setCurrentCardIndex(0);
    setSessionScore(0);
    setSelectedAnswer(null);
    setIsAnswerCorrect(null);
    setShowNextButton(false);
    setGameState(GameState.Playing);
  };

  // --- Get Current Card ---
  const currentCard = sessionCards[currentCardIndex];

  useEffect(() => {
    if (gameState !== GameState.Playing || !currentCard) return;

    const runId = ++questionIdRef.current; // unique per question
    const abort = new AbortController();

    // hard reset UI for this round
    setQuestionLoading(true);
    setSelectedAnswer(null);
    setIsAnswerCorrect(null);
    setShowNextButton(false);
    setQuizStatement("");

    (async () => {
      try {
        // Reset the prompt client's context to ensure this question is not influenced by the previous one.
        await promptClient.resetContext({ signal: abort.signal });

        // Fetch both true and false statements for the card. The client will cache them.
        const pair = await promptClient.getPairForCard(currentCard, abort.signal);

        if (abort.signal.aborted || questionIdRef.current !== runId) return;

        // Randomly decide whether to show the true or false statement
        const showFalseStatement = Math.random() < 0.5;

        if (showFalseStatement) {
          setQuizStatement(pair.falseText);
          setIsStatementTrue(false);
        } else {
          setQuizStatement(pair.trueText);
          setIsStatementTrue(true);
        }
      } catch (err) {
        if (!abort.signal.aborted) {
          console.error("Failed to generate quiz options:", err);
          setGameState(GameState.NotStarted);
          alert("Failed to generate quiz options. Please try again.");
        }
      } finally {
        if (!abort.signal.aborted && questionIdRef.current === runId) {
          setQuestionLoading(false);
        }
      }
    })();

    return () => abort.abort();
  }, [currentCard?.id, gameState]); // Re-run when card or game state changes

  // --- Handle User Answering ---
  const handleAnswerSelection = (userThinksItIsTrue: boolean) => {
    if (selectedAnswer !== null || questionLoading) return;
    setSelectedAnswer(userThinksItIsTrue);
    const correct = userThinksItIsTrue === isStatementTrue;
    setIsAnswerCorrect(correct);
    setShowNextButton(true);
    if (correct) setSessionScore((prev) => prev + 1);
  };

  // --- NEW: Function to record the answer for the current card ---
  const recordCurrentCardAnswer = async () => {
    if (!currentCard) return;
    // Determine SRS quality based on correctness
    const quality: ReviewQuality = isAnswerCorrect ? 4 : 0; // Correct = Good, Incorrect = Again
    await updateCardSRS(currentCard, quality);
  };

  // --- Handle Moving to Next Question ---
  const handleNextQuestion = async () => {
    // First, record the result of the card we just answered.
    await recordCurrentCardAnswer();

    // Move to next card or finish
    if (currentCardIndex < sessionCards.length - 1) {
      setCurrentCardIndex((prev) => prev + 1);
      // Reset state for the new card
      setSelectedAnswer(null);
      setIsAnswerCorrect(null);
      setShowNextButton(false);
    } else {
      // This was the last card. The answer was recorded by the awaited
      // `recordCurrentCardAnswer()` call at the start of this function.
      // Now we can safely finish the game.
      setGameState(GameState.Finished);
    }
  };

  // --- NEW: Function to record the completed test session ---
  const recordTestSession = async () => {
    const sessionResult: TestSession = {
      completedAt: new Date(),
      score: sessionScore,
      totalQuestions: sessionCards.length,
      quizSize: quizSize,
    };
    await db.testSessions.add(sessionResult);
    console.log("Test session recorded:", sessionResult);
  };

  // --- Reset to Start Screen ---
  const handleRestart = () => {
    if (
      gameState !== GameState.Playing ||
      window.confirm("Are you sure you want to quit? Your progress will be lost.")
    ) {
      setGameState(GameState.NotStarted);
    }
  };

  // --- Effect to run when game finishes ---
  useEffect(() => {
    if (gameState === GameState.Finished) {
      // Record the session when the game is finished.
      recordTestSession();
    }
  }, [gameState]);

  // --- Render Logic ---

  if (gameState === GameState.Loading) {
    return <div className="text-center text-zinc-400">Loading cards...</div>;
  }

  if (gameState === GameState.NotStarted) {
    return (
      <div className="flex flex-col items-center justify-center space-y-6 pt-10">
        <h2 className="text-xl font-semibold text-white">Ready for a Quiz?</h2>

        {/* Quiz Size Selector */}
        <div className="flex items-center space-x-2 rounded-lg bg-zinc-800 p-1">
          {([5, 10, "all"] as const).map((size) => (
            <button
              key={size}
              onClick={() => setQuizSize(size)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                quizSize === size
                  ? "bg-blue-600 text-white"
                  : "text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {size === "all" ? "All Cards" : `${size} Cards`}
            </button>
          ))}
        </div>

        <button
          onClick={() => handleStartSession(quizSize)}
          className="rounded-lg bg-blue-600 px-6 py-3 text-lg font-semibold text-white transition-colors hover:bg-blue-500"
        >
          Start Quiz
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
    return (
      <div className="text-center text-red-400">Error: No card to display.</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative flex items-center justify-center">
        <button
          onClick={handleRestart}
          className="absolute left-0 rounded-md px-2 py-1 text-sm text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white"
        >
          &lt; Quit
        </button>
        <div className="text-sm text-zinc-400">
          Question {currentCardIndex + 1} of {sessionCards.length}
        </div>
      </div>

      {/* --- Question Prompt --- */}
      {questionLoading ? (
        <div className="text-center text-zinc-400 py-8">
          Generating question...
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-4 text-center">
            <p className="text-sm text-zinc-400">
              Is this statement about{" "}
              <strong className="text-blue-400">{currentCard.concept}</strong>{" "}
              true or false?
            </p>
            <blockquote className="mt-2 text-lg italic text-white">
              "{quizStatement}"
            </blockquote>
          </div>

          {/* --- True/False Buttons --- */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            {[true, false].map((value) => {
              const label = value ? "True" : "False";
              let buttonClass =
                "rounded-md p-4 text-lg font-semibold text-center transition-colors ";
              const isSelected = selectedAnswer === value;
              const isCorrectChoice = isStatementTrue === value;

              if (selectedAnswer === null) {
                // Not answered yet
                buttonClass += "bg-zinc-700 text-white hover:bg-zinc-600";
              } else if (isSelected) {
                // This button was selected by the user
                buttonClass += isAnswerCorrect
                  ? "bg-green-600 text-white"
                  : "bg-red-600 text-white";
              } else if (isCorrectChoice) {
                // This is the correct answer, but wasn't selected
                buttonClass +=
                  "bg-green-800 text-green-300 border border-green-600";
                // This is the correct answer, but wasn't selected. Highlight it.
                buttonClass += "bg-green-600 text-white border border-green-400";
              } else {
                // Incorrect, unselected option
                buttonClass += "bg-zinc-800 text-zinc-500 cursor-not-allowed";
              }

              return (
                <button
                  key={label}
                  onClick={() => handleAnswerSelection(value)}
                  disabled={selectedAnswer !== null}
                  className={buttonClass}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* --- Next Button --- */}
      {showNextButton && (
        <button
          onClick={handleNextQuestion}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500 mt-6"
        >
          Next Question
        </button>
      )}
    </div>
  );
}
