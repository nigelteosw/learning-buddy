import React from 'react';
import { Card } from '@/lib/db';
import { QuizView, ParsedQuiz } from './QuizView';

type ReviewListItemProps = {
  card: Card;
  isOpen: boolean;
  isQuizzing: boolean;
  quizData: ParsedQuiz | null;
  isQuizLoading: boolean;
  quizError: string | null;
  onToggle: (isOpen: boolean) => void;
  onEditRequest: (card: Card) => void;
  onDeleteCard: (id: number) => void;
  onGenerateQuiz: (card: Card) => void;
  onResetQuiz: () => void;
};

export function ReviewListItem({
  card,
  isOpen,
  isQuizzing,
  quizData,
  isQuizLoading,
  quizError,
  onToggle,
  onEditRequest,
  onDeleteCard,
  onGenerateQuiz,
  onResetQuiz,
}: ReviewListItemProps) {
  return (
    <details
      key={card.id}
      open={isOpen}
      onToggle={(e) => onToggle((e.target as HTMLDetailsElement).open)}
      className="group rounded-lg border border-zinc-700 bg-zinc-800 p-3"
    >
      <summary className="flex cursor-pointer items-center justify-between font-semibold text-blue-400">
        {card.concept}

        <div className="flex items-center space-x-2">
          {/* --- RESET BUTTON --- */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onResetQuiz();
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
            onClick={() => onDeleteCard(card.id!)}
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
            className={`mt-1 text-zinc-100 transition-all ${
              isQuizzing ? 'cursor-pointer blur-sm hover:blur-none' : ''
            }`}
          >
            {card.front}
          </p>
        </div>
        <div>
          <h4 className="font-medium text-zinc-400">Explanation</h4>
          <p
            className={`mt-1 text-zinc-100 transition-all ${
              isQuizzing ? 'cursor-pointer blur-sm hover:blur-none' : ''
            }`}
          >
            {card.back}
          </p>
        </div>
        {/* Tags Display */}
        {card.tags && card.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 py-2">
            {card.tags.map((tag, index) => (
              <span
                key={index}
                className="rounded-md bg-zinc-700 px-2.5 py-0.5 text-xs font-medium text-zinc-300"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
        <QuizView
          card={card}
          quiz={isQuizzing ? quizData : null}
          isLoading={isQuizzing ? isQuizLoading : false}
          error={isQuizzing ? quizError : null}
          onGenerate={() => onGenerateQuiz(card)}
        />
      </div>
    </details>
  );
}
