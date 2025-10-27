import { db, Card } from './db';

// --- Card Selection ---

/**
 * Gets all cards that are due for review today (or overdue).
 */
export async function getDueCards(): Promise<Card[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today

  return db.cards
    .where('dueDate')
    .belowOrEqual(today)
    .toArray();
}

// --- SM-2 Algorithm Implementation (Simplified) ---

// Represents user feedback quality (0=Fail, 3=Hard, 4=Good, 5=Easy)
export type ReviewQuality = 0 | 3 | 4 | 5; 

/**
 * Updates a card's SRS parameters based on review quality.
 * @param card The card that was reviewed.
 * @param quality How well the user remembered the card (0-5).
 */
export async function updateCardSRS(card: Card, quality: ReviewQuality): Promise<void> {
  if (!card.id) return; // Should not happen with cards from DB

  let newInterval: number;
  let newEaseFactor: number;

  if (quality < 3) {
    // Failed recall (Again/Hard) - Reset interval
    newInterval = 1; // Show again tomorrow (or in the same session)
    newEaseFactor = Math.max(1.3, card.easeFactor - 0.2); // Decrease ease slightly
  } else {
    // Successful recall (Good/Easy)
    if (card.interval <= 1) {
      // First successful recall
      newInterval = 6;
    } else {
      // Subsequent successful recall
      newInterval = Math.round(card.interval * card.easeFactor);
    }
    // Adjust ease factor based on how easy it was
    newEaseFactor = card.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    newEaseFactor = Math.max(1.3, newEaseFactor); // Ease factor minimum
  }

  // Calculate the next due date
  const now = new Date();
  const nextDueDate = new Date(now);
  nextDueDate.setDate(now.getDate() + newInterval);
  nextDueDate.setHours(0, 0, 0, 0); // Set to start of the day

  // Update the card in the database
  await db.cards.update(card.id, {
    dueDate: nextDueDate,
    interval: newInterval,
    easeFactor: newEaseFactor,
  });
}