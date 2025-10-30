import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/lib/db';

type QuizViewProps = {
  card: Card;
  quiz: ParsedQuiz | null;
  isLoading: boolean;
  error: string | null;
  onGenerate: () => void;
};

export type ParsedQuiz = {
  question: string;
  options: Record<string, string>;
  correctAnswerKey: string;
};

export function parseQuiz(text: string): ParsedQuiz | null {
  try {
    const questionMatch = text.match(/Question:\s*(.*)/);
    const optionsA = text.match(/A\)\s*(.*)/);
    const optionsB = text.match(/B\)\s*(.*)/);
    const optionsC = text.match(/C\)\s*(.*)/);
    const optionsD = text.match(/D\)\s*(.*)/);
    const answerMatch = text.match(/Correct Answer:\s*([A-D])/);

    if (
      !questionMatch ||
      !optionsA ||
      !optionsB ||
      !optionsC ||
      !optionsD ||
      !answerMatch
    ) {
      return null;
    }

    return {
      question: questionMatch[1].trim(),
      options: {
        A: optionsA[1].trim(),
        B: optionsB[1].trim(),
        C: optionsC[1].trim(),
        D: optionsD[1].trim(),
      },
      correctAnswerKey: answerMatch[1].trim(),
    };
  } catch (e) {
    console.error('Failed to parse quiz text:', e);
    return null;
  }
}

export function QuizView({ card, quiz, isLoading, error, onGenerate }: QuizViewProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);

  const handleOptionClick = (key: string) => {
    if (isRevealed) return;
    setSelectedOption(key);
    setIsRevealed(true);
  };

  const getButtonClass = (key: string) => {
    if (!isRevealed) {
      return 'bg-zinc-700 hover:bg-zinc-600';
    }
    if (key === quiz?.correctAnswerKey) {
      return 'bg-green-700 ring-2 ring-green-400';
    }
    if (key === selectedOption) {
      return 'bg-red-700 ring-2 ring-red-500';
    }
    return 'bg-zinc-800 opacity-60';
  };

  return (
    <div className="space-y-4 rounded-lg border border-zinc-700 bg-zinc-900 p-4">
      {!quiz && !isLoading && !error && (
        <button
          onClick={onGenerate}
          className="w-full rounded-md bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-400"
        >
          Quiz Me!
        </button>
      )}

      {isLoading && <p className="text-center text-zinc-400">Generating quiz...</p>}
      {error && <p className="text-center text-red-400">{error}</p>}

      {quiz && (
        <div className="space-y-4">
          <p className="font-semibold text-white">{quiz.question}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Object.entries(quiz.options).map(([key, text]) => (
              <button
                key={key}
                onClick={() => handleOptionClick(key)}
                disabled={isRevealed}
                className={`rounded-md p-3 text-left text-sm text-white transition-all ${getButtonClass(
                  key
                )}`}
              >
                <span className="mr-2 font-bold">{key})</span>
                {text}
              </button>
            ))}
          </div>
          {isRevealed && (
            <div className="flex justify-center">
              <button
                onClick={onGenerate}
                className="mt-2 rounded-md bg-zinc-600 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-500"
              >
                Generate Another
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}