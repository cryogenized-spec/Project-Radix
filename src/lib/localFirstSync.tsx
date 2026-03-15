import React, { createContext, useContext, useEffect, useState } from 'react';
import * as Y from 'yjs';

class SQLiteOPFSProvider {
  doc: Y.Doc;
  dbName: string;
  
  constructor(doc: Y.Doc, dbName: string) {
    this.doc = doc;
    this.dbName = dbName;
    this.init();
  }

  async init() {
    this.doc.on('update', (update: Uint8Array) => {
    });
  }
}

class Libp2pProvider {
  doc: Y.Doc;
  roomName: string;
  
  constructor(doc: Y.Doc, roomName: string) {
    this.doc = doc;
    this.roomName = roomName;
    this.init();
  }

  async init() {
    this.doc.on('update', (update: Uint8Array) => {
    });
  }
}

interface LocalFirstContextType {
  doc: Y.Doc | null;
  isSynced: boolean;
}

const LocalFirstContext = createContext<LocalFirstContextType>({ doc: null, isSynced: false });

export const LocalFirstProvider = ({ children }: { children: React.ReactNode }) => {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [isSynced, setIsSynced] = useState(false);

  useEffect(() => {
    const ydoc = new Y.Doc();
    const persistence = new SQLiteOPFSProvider(ydoc, 'organizer-db.sqlite');
    const network = new Libp2pProvider(ydoc, 'organizer-sync-room');

    setDoc(ydoc);
    
    setTimeout(() => setIsSynced(true), 1000);

    return () => {
      ydoc.destroy();
    };
  }, []);

  const value = { doc, isSynced };

  return (
    <LocalFirstContext.Provider value={value}>
      {children}
    </LocalFirstContext.Provider>
  );
};

export const useLocalFirst = () => useContext(LocalFirstContext);

export const useSharedNotes = () => {
  const { doc } = useLocalFirst();
  const [notes, setNotes] = useState<any[]>([]);

  useEffect(() => {
    if (!doc) return;
    
    const yNotes = doc.getArray('notes');
    
    const updateNotes = () => setNotes(yNotes.toArray());
    yNotes.observe(updateNotes);
    updateNotes();

    return () => yNotes.unobserve(updateNotes);
  }, [doc]);

  const addNote = (note: any) => {
    if (doc) doc.getArray('notes').push([note]);
  };

  return { notes, addNote };
};
