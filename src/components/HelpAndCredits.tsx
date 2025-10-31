import React from 'react';

export function HelpAndCredits() {
  return (
    <div className="space-y-6 text-zinc-300">
      <div className="space-y-4 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
        <h2 className="text-lg font-semibold text-white">How to Use Learning Buddy</h2>
        <p>1. <strong className="text-white">Highlight Text:</strong> On any webpage, select text you want to learn about and right-click to choose "Explain with Learning Buddy".</p>
        <p>2. <strong className="text-white">Save Cards:</strong> The side panel will open with an explanation. Review it, edit if you like, and save it as a flashcard.</p>
        <p>3. <strong className="text-white">Test Yourself:</strong> Go to the "Test" tab to start a quiz on your saved cards. The app uses Spaced Repetition to help you remember.</p>
      </div>

      <div className="space-y-4 rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
        <h2 className="text-lg font-semibold text-white">Credits & Technologies</h2>
        <p>This extension was built with love using some amazing open-source technologies:</p>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li><strong className="text-white">React & TypeScript:</strong> For building a modern and robust user interface.</li>
          <li><strong className="text-white">Tailwind CSS:</strong> For rapid, utility-first styling.</li>
          <li><strong className="text-white">Dexie.js:</strong> For a powerful and friendly local database in your browser.</li>
          <li><strong className="text-white">Google's Gemini:</strong> For providing the AI-powered explanations.</li>
        </ul>
      </div>
    </div>
  );
}