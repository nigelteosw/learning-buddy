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
    this.version(2).stores({
      // The '*' before 'tags' creates a multi-entry index.
      // This allows Dexie to efficiently query for individual tags within the array.
      cards: '++id, concept, dueDate, *tags'
    });
  }
}

// 4. Export a single, shared instance of the database
export const db = new TutorDexie();