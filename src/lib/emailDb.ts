import Dexie, { Table } from 'dexie';

export interface RadixMessage {
  id?: number;
  threadId: string;
  status: 'Draft' | 'Sent' | 'Received';
  subject: string;
  body: string;
  timestamp: number;
  metadata?: any;
}

export interface RadixAttachment {
  cid: string;
  data: Uint8Array;
  mimeType: string;
}

export class EmailDatabase extends Dexie {
  emails!: Table<RadixMessage, number>;
  attachments!: Table<RadixAttachment, string>;

  constructor() {
    super('RadixEmailDB');
    this.version(1).stores({
      emails: '++id, threadId, status, timestamp',
      attachments: 'cid'
    });
  }
}

export const emailDb = new EmailDatabase();
