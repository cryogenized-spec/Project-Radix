import Dexie, { Table } from 'dexie';

export interface StickerPack {
  id: string;
  name: string;
  coverStickerId?: string;
  createdAt: number;
}

export interface Sticker {
  id: string;
  name: string;
  prompt: string;
  masterBlob: Blob;
  exportBlob: Blob;
  packId: string;
  createdAt: number;
}

export class StickerDatabase extends Dexie {
  stickerPacks!: Table<StickerPack, string>;
  stickers!: Table<Sticker, string>;

  constructor() {
    super('StickerDatabase');
    this.version(1).stores({
      stickerPacks: 'id, name, createdAt',
      stickers: 'id, packId, createdAt'
    });
  }
}

export const stickerDb = new StickerDatabase();
