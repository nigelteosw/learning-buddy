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
}

// 2. Create your database "class"
export class TutorDexie extends Dexie {
  // 'cards' is the name of your data table
  cards!: Table<Card>; 

  constructor() {
    super('tutorDatabase'); // The name of the database in the browser
    this.version(1).stores({
      // 3. Define your table and its "indexes"
      // '++id' = Auto-incrementing primary key
      // 'heading' & 'dueDate' = Other fields we want to search by
      cards: '++id, concept, dueDate',
    });
  }
}

// 4. Export a single, shared instance of the database
export const db = new TutorDexie();