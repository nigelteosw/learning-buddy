import Dexie, { Table } from 'dexie';

// 1. Define the TypeScript "shape" of your card
export interface Card {
  id?: number; 
  concept: string;
  front: string;    // The original highlighted text
  back: string;     // The AI explanation
  createdAt: Date;
  dueDate: Date;    // For spaced repetition
  interval: number; // SM-2 interval
  easeFactor: number; // SM-2 ease factor
  tags?: string[];
}

// 2. Create your database "class"
export class TutorDexie extends Dexie {
  // 'cards' is the name of your data table
  cards!: Table<Card>; 

  constructor() {
    super('learning-buddy-db'); 
    // IMPORTANT: Increment the version number when changing the schema.
    // Here we go from 1 to 2.
    this.version(3).stores({
      // The '*' before 'tags' creates a multi-entry index.
      // This allows Dexie to efficiently query for individual tags within the array.
      // Added 'createdAt' to the index for efficient sorting.
      cards: '++id, concept, dueDate, createdAt, *tags'
    });
  }
}

// 4. Export a single, shared instance of the database
export const db = new TutorDexie();

/**
 * Fetches a paginated, filtered, and sorted list of cards.
 * @returns A promise that resolves to an object containing the cards for the page and the total count of matching cards.
 */
export async function getPaginatedCards(options: {
  page: number;
  limit: number;
  sortBy: string;
  searchTerm: string;
}): Promise<{ cards: Card[]; totalCount: number }> {
  const { page, limit, sortBy, searchTerm } = options;
  const offset = (page - 1) * limit;

  // Start with the base collection
  let collection = db.cards.toCollection();

  // 1. Filter
  if (searchTerm) {
    const lowerTerm = searchTerm.toLowerCase();
    // This filter runs in-memory after the initial collection is retrieved,
    // but it's necessary for case-insensitive, multi-field search.
    collection = collection.filter(card =>
      card.concept?.toLowerCase().includes(lowerTerm) ||
      card.front.toLowerCase().includes(lowerTerm) ||
      card.back.toLowerCase().includes(lowerTerm)
    );
  }

  // We need the total count of filtered items for pagination
  const totalCount = await collection.count();

  // 2. Sort the entire collection first.
  // Dexie's sortBy() is always ascending. To sort descending, we use reverse()
  // before sortBy().
  let sortedCollection;
  if (sortBy.endsWith('_desc')) {
    const sortKey = sortBy.replace('_desc', '');
    sortedCollection = collection.reverse().sortBy(sortKey);
  } else {
    const sortKey = sortBy.replace('_asc', '');
    sortedCollection = collection.sortBy(sortKey);
  }

  // 3. Paginate the sorted results.
  const paginatedCards = await sortedCollection.then(sorted => sorted.slice(offset, offset + limit));

  return { cards: paginatedCards, totalCount };
}