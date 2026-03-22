import Dexie, { Table } from 'dexie';

export interface Event {
  id?: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  duration?: number; // minutes
  alertOffset?: number; // minutes before
  alertType?: 'notification' | 'email' | 'none';
  recurrence?: {
    type: 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';
    interval?: number;
    daysOfWeek?: number[]; // 0-6
    endDate?: string;
  };
  subtasks?: string[];
  linkedTaskId?: string;
  linkedNoteId?: string;
  createdAt: number;
  updatedAt: number;
  isRecurringInstance?: boolean;
  originalId?: string;
}

export interface DaySchedule {
  day: string; // 'monday', 'tuesday', etc.
  wakeTime: string; // '07:00'
  sleepTime: string; // '23:00'
  workStart: string; // '09:00'
  workEnd: string; // '17:00'
  isWorkDay: boolean;
}

export interface UserSettings {
  id?: number;
  schedule: DaySchedule[];
  notesFontSize?: number;
  notesListTileSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  folderExpanded?: Record<string, boolean>;
}

export interface Subtask {
  id: string;
  text: string;
  completed: boolean;
}

export interface Task {
  id?: string;
  title: string;
  text?: string;
  status?: 'active' | 'completed';
  priority?: 'low' | 'medium' | 'high';
  subtasksList?: Subtask[];
  category?: string;
  headerId?: string;
  completed: boolean;
  orderIndex: number;
  subtasks?: string[];
  alertOffset?: number;
  linkedEventId?: string;
  linkedNoteId?: string;
  createdAt: number;
  updatedAt: number;
  dueDate?: number;
  duration?: number;
  tags?: string[];
}

export interface Header {
  id?: string;
  title: string;
  orderIndex: number;
}

export interface Note {
  id?: string;
  title?: string;
  content: string;
  linkedEventId?: string;
  linkedTaskId?: string;
  createdAt: number;
  updatedAt: number;
  isFolder?: boolean;
  parentId?: string;
  orderIndex?: number;
  attachments?: { name: string, type: string, data: Blob | string }[];
}

export interface OrganizerThread {
  id?: string;
  type: 'organizer';
  messages: any[];
  linkedEntityIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface DocumentRecord {
  id: string;
  fileName: string;
  timestamp: number;
  blob: Blob;
  ocrText: string;
  tags: string[];
}

export interface SearchIndexRecord {
  id?: number;
  word: string;
  documentId: string;
}

export interface UndoOperation {
  id?: string;
  operation: string;
  payload: any;
  timestamp: number;
}

export class OrganizerDatabase extends Dexie {
  events!: Table<Event>;
  tasks!: Table<Task>;
  headers!: Table<Header>;
  notes!: Table<Note>;
  threads!: Table<OrganizerThread>;
  undoStack!: Table<UndoOperation>;
  settings!: Table<UserSettings>;
  documents!: Table<DocumentRecord>;
  search_index!: Table<SearchIndexRecord>;

  constructor() {
    super('OrganizerDB');
    this.version(1).stores({
      events: '++id, date, title, createdAt',
      tasks: '++id, headerId, completed, orderIndex, createdAt',
      headers: '++id, orderIndex',
      notes: '++id, createdAt',
      threads: '++id, type, createdAt',
      undoStack: '++id, timestamp',
      settings: '++id'
    });
    
    this.version(2).stores({
      notes: '++id, createdAt, updatedAt'
    });

    this.version(3).stores({
      events: '++id, date, title, createdAt' // Schema update for new fields if needed, mostly implicit in Dexie
    });

    this.version(4).stores({
      settings: '++id'
    });

    this.version(5).stores({
      notes: '++id, createdAt, updatedAt, parentId, orderIndex'
    });

    this.version(6).stores({
      documents: 'id, timestamp, *tags',
      search_index: '++id, word, documentId'
    });
  }

  async getUserSettings(): Promise<UserSettings | undefined> {
    const settings = await this.settings.toArray();
    return settings[0];
  }

  async setUserSettings(settings: UserSettings): Promise<void> {
    const existing = await this.getUserSettings();
    if (existing && existing.id) {
      await this.settings.put({ ...existing, ...settings, id: existing.id });
    } else {
      await this.settings.put(settings);
    }
    window.dispatchEvent(new Event('settings:updated'));
  }
}

export const db = new OrganizerDatabase();
