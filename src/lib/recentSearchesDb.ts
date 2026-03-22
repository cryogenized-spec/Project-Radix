import Dexie, { Table } from 'dexie';

export interface RecentSearch {
  query: string;
  timestamp: number;
}

export class RecentSearchesDatabase extends Dexie {
  searches!: Table<RecentSearch, string>;

  constructor() {
    super('RecentSearchesDB');
    this.version(1).stores({
      searches: 'query, timestamp'
    });
  }
}

export const recentSearchesDb = new RecentSearchesDatabase();
