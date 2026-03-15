import { useState, useEffect, useCallback } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

// Singleton Y.Doc for the entire application state
const ydoc = new Y.Doc();
const provider = new IndexeddbPersistence('radix-hybrid-state', ydoc);

export type FrameType = 'doc' | 'sheet' | 'canvas' | 'scanner' | 'task';

export interface RadixFrame {
  id: string;
  type: FrameType;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  content: any; // Text, Sheet data, Canvas elements, etc.
  date?: string; // For temporal binding to calendar
  parentId?: string; // For nesting frames
  linkedTaskId?: string;
  linkedEventId?: string;
}

// Shared Y.js Data Structures
const framesArray = ydoc.getArray<Y.Map<any>>('frames');
const metadataMap = ydoc.getMap<any>('metadata');

export function useRadixSync() {
  const [frames, setFrames] = useState<RadixFrame[]>([]);
  const [isSynced, setIsSynced] = useState(false);

  useEffect(() => {
    provider.on('synced', () => {
      setIsSynced(true);
    });

    const updateFrames = () => {
      const currentFrames = framesArray.toArray().map(yMap => yMap.toJSON() as RadixFrame);
      setFrames(currentFrames);
    };

    framesArray.observeDeep(updateFrames);
    updateFrames();

    return () => {
      framesArray.unobserveDeep(updateFrames);
    };
  }, []);

  const addFrame = useCallback((frame: Omit<RadixFrame, 'id'>) => {
    const id = crypto.randomUUID();
    const yMap = new Y.Map();
    
    yMap.set('id', id);
    yMap.set('type', frame.type);
    yMap.set('x', frame.x);
    yMap.set('y', frame.y);
    yMap.set('z', frame.z);
    yMap.set('w', frame.w);
    yMap.set('h', frame.h);
    yMap.set('content', frame.content);
    if (frame.date) yMap.set('date', frame.date);
    if (frame.parentId) yMap.set('parentId', frame.parentId);
    if (frame.linkedTaskId) yMap.set('linkedTaskId', frame.linkedTaskId);
    if (frame.linkedEventId) yMap.set('linkedEventId', frame.linkedEventId);

    framesArray.push([yMap]);
    return id;
  }, []);

  const updateFrame = useCallback((id: string, updates: Partial<RadixFrame>) => {
    const yMap = framesArray.toArray().find(map => map.get('id') === id);
    if (yMap) {
      ydoc.transact(() => {
        Object.entries(updates).forEach(([key, value]) => {
          yMap.set(key, value);
        });
      });
    }
  }, []);

  const deleteFrame = useCallback((id: string) => {
    const index = framesArray.toArray().findIndex(map => map.get('id') === id);
    if (index !== -1) {
      framesArray.delete(index, 1);
    }
  }, []);

  // Helper to get frames by date (for Calendar)
  const getFramesByDate = useCallback((date: string) => {
    return frames.filter(f => f.date === date);
  }, [frames]);

  // Helper to get tasks (for Task List)
  const getTasks = useCallback(() => {
    return frames.filter(f => f.type === 'task' || f.linkedTaskId);
  }, [frames]);

  return {
    frames,
    isSynced,
    addFrame,
    updateFrame,
    deleteFrame,
    getFramesByDate,
    getTasks,
    ydoc
  };
}
