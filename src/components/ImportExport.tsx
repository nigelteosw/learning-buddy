// @/components/ImportExport.tsx
import React, { useState } from 'react';
import { db, Card } from '@/lib/db';
import { z } from 'zod';

// --- Zod Validation Schemas ---
// This ensures that the data we import matches our Card interface.
// It's especially important for converting date-strings back to Date objects.
const cardImportSchema = z.object({
  concept: z.string(),
  front: z.string(),
  back: z.string(),
  createdAt: z.string().datetime().or(z.date()), // Accepts ISO string or Date object
  dueDate: z.string().datetime().or(z.date()),
  interval: z.number().int(),
  easeFactor: z.number(),
  // We intentionally omit 'id' to let Dexie auto-generate new ones
});

// The full import file should be an array of these card objects
const importFileSchema = z.array(cardImportSchema);

// --- Helper Functions ---
function getStyledButtonClasses(disabled: boolean = false) {
  return `w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm ${
    disabled
      ? 'cursor-not-allowed opacity-50'
      : 'hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
  }`;
}

function getStyledFileLabelClasses(disabled: boolean = false) {
  return `block w-full rounded-md bg-zinc-700 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm ${
    disabled
      ? 'cursor-not-allowed opacity-50'
      : 'cursor-pointer hover:bg-zinc-600'
  }`;
}

// --- The Component ---
export function ImportExport() {
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  /**
   * Handles exporting all cards to a JSON file.
   */
  const handleExport = async () => {
    setIsWorking(true);
    setMessage(null);
    try {
      const allCards = await db.cards.toArray();
      if (allCards.length === 0) {
        setMessage({ type: 'error', text: 'There are no cards to export.' });
        return;
      }

      const jsonString = JSON.stringify(allCards, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');

      const timestamp = new Date().toISOString().split('T')[0]; // e.g., '2025-10-30'
      a.href = url;
      a.download = `tutor-cards-backup-${timestamp}.json`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessage({ type: 'success', text: `Successfully exported ${allCards.length} cards.` });
    } catch (error) {
      console.error('Export failed:', error);
      setMessage({ type: 'error', text: `Export failed: ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      setIsWorking(false);
    }
  };

  /**
   * Handles importing cards from a selected JSON file.
   */
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsWorking(true);
    setMessage(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);

        // 1. Validate the file structure
        const validationResult = importFileSchema.safeParse(data);
        if (!validationResult.success) {
          console.error('Invalid JSON structure:', validationResult.error.flatten());
          throw new Error('Invalid file format. Check console for details.');
        }

        // 2. Prepare data for Dexie (convert dates, remove IDs)
        const cardsToImport: Omit<Card, 'id'>[] = validationResult.data.map(item => ({
          concept: item.concept,
          front: item.front,
          back: item.back,
          createdAt: new Date(item.createdAt), // Convert string back to Date
          dueDate: new Date(item.dueDate),     // Convert string back to Date
          interval: item.interval,
          easeFactor: item.easeFactor,
        }));

        if (cardsToImport.length === 0) {
          setMessage({ type: 'error', text: 'No valid cards found in the file.' });
          return;
        }

        // 3. Add to database
        const newKeys = await db.cards.bulkAdd(cardsToImport, { allKeys: true });
        setMessage({ type: 'success', text: `Successfully imported ${newKeys.length} cards.` });

      } catch (error) {
        console.error('Import failed:', error);
        setMessage({ type: 'error', text: `Import failed: ${error instanceof Error ? error.message : String(error)}` });
      } finally {
        setIsWorking(false);
        // Reset file input to allow uploading the same file again
        event.target.value = '';
      }
    };

    reader.onerror = () => {
      setMessage({ type: 'error', text: 'Failed to read the file.' });
      setIsWorking(false);
    };

    reader.readAsText(file);
  };

  return (
    <div className="space-y-8 rounded-lg bg-zinc-800 p-6">
      {/* --- Message Display --- */}
      {message && (
        <div
          className={`rounded-md p-4 text-sm ${
            message.type === 'success'
              ? 'bg-green-900 text-green-200'
              : 'bg-red-900 text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* --- Export Section --- */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold leading-6 text-white">Export Data</h3>
        <p className="text-sm text-zinc-400">
          Save a backup of all your cards to a JSON file. This file can be used
          to restore your collection later or transfer it to another device.
        </p>
        <button
          onClick={handleExport}
          disabled={isWorking}
          className={getStyledButtonClasses(isWorking)}
        >
          {isWorking ? 'Exporting...' : 'Export All Cards'}
        </button>
      </div>

      {/* --- Horizontal Rule --- */}
      <div className="border-t border-zinc-700"></div>

      {/* --- Import Section --- */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold leading-6 text-white">Import Data</h3>
        <p className="text-sm text-zinc-400">
          Load cards from a JSON backup file. This will <strong>add</strong> the cards from
          the file to your existing collection. It will not delete or overwrite
          cards.
        </p>
        <label className={getStyledFileLabelClasses(isWorking)}>
          {isWorking ? 'Importing...' : 'Import from JSON'}
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            disabled={isWorking}
            className="hidden" // The label acts as the visible button
          />
        </label>
      </div>
    </div>
  );
}