import Dexie, { Table } from 'dexie';
import { encryptData, decryptData, isCryptoInitialized } from './crypto';

export class RadixDB extends Dexie {
  messages!: Table<any>;
  settings!: Table<any>;
  threads!: Table<any>;
  groups!: Table<any>;
  contacts!: Table<any>;
  agents!: Table<any>;
  media!: Table<any>; // Separate table for media blobs to manage LRU easily
  file_map!: Table<any>;
  directory_handles!: Table<any>;
  icons!: Table<any>;
  channels!: Table<any>;
  folders!: Table<any>;
  feeds!: Table<any>;
  channeler_prompts!: Table<any>;
  ai_assets!: Table<any>;
  radixContacts!: Table<any>;
  whatsappContacts!: Table<any>;
  whatsappMessages!: Table<any>;
  agent_telemetry_logs!: Table<any>;
  exa_api_usage!: Table<any>;

  constructor() {
    super('radix_db');
    this.version(12).stores({
      messages: 'id, timestamp, threadId, type, isAiChat', // Indexed fields
      settings: 'key',
      threads: 'id, lastMessageTime',
      groups: 'id, lastMessageTime',
      contacts: 'id, name',
      agents: 'id, name',
      media: 'id, timestamp, size, type', // For LRU pruning based on timestamp
      file_map: 'filePath, fileName, extension, lastModified',
      directory_handles: 'id',
      icons: 'name',
      channels: 'id, name, folderId',
      folders: 'id, name',
      feeds: 'id, url, type, channelId',
      channeler_prompts: 'id, name',
      ai_assets: 'id, modelName',
      radixContacts: '++id, name, publicKey, dateAdded',
      whatsappContacts: '++id, name, phoneNumber, dateAdded',
      whatsappMessages: '++id, contactId, textContent, timestamp, type',
      agent_telemetry_logs: '++id, agentId, timestamp, type',
      exa_api_usage: 'month, count'
    });

    // Encryption Middleware
    this.use({
      stack: 'dbcore',
      name: 'encryption',
      create(downlevelDatabase) {
        return {
          ...downlevelDatabase,
          table(tableName) {
            const downlevelTable = downlevelDatabase.table(tableName);
            return {
              ...downlevelTable,
              async get(req) {
                const result = await downlevelTable.get(req);
                if (result && result.encrypted && isCryptoInitialized()) {
                  try {
                    const decrypted = await decryptData(result.ciphertext, result.nonce);
                    return { ...result, ...decrypted, encrypted: false };
                  } catch (e) {
                    console.error('Decryption failed', e);
                    return result; // Return encrypted if key is wrong/missing
                  }
                }
                return result;
              },
              async mutate(req) {
                if (isCryptoInitialized() && (tableName === 'messages' || tableName === 'media')) {
                  // Encrypt sensitive data
                  const encryptEntry = async (entry: any) => {
                    if (entry.encrypted) return entry; // Already encrypted
                    const { id, timestamp, ...rest } = entry;
                    // Encrypt everything except ID and timestamp (needed for indexing/LRU)
                    const { ciphertext, nonce } = await encryptData(rest);
                    const encryptedEntry: any = {
                      timestamp,
                      encrypted: true,
                      ciphertext,
                      nonce
                    };
                    if (id !== undefined) {
                      encryptedEntry.id = id;
                    }
                    return encryptedEntry;
                  };

                  if (req.type === 'put') {
                    const values = await Promise.all(req.values.map(encryptEntry));
                    return downlevelTable.mutate({ ...req, values });
                  } else if (req.type === 'add') {
                    const values = await Promise.all(req.values.map(encryptEntry));
                    return downlevelTable.mutate({ ...req, values });
                  }
                }
                return downlevelTable.mutate(req);
              }
            };
          }
        };
      }
    });
  }
}

export const db = new RadixDB();

export async function cacheIcon(name: string, data: any) {
  // Clear existing icons first to ensure only 1 is cached for this slot
  // Note: If we expand to multiple slots later, we'll need a slot ID or similar.
  // For now, the requirement is "only 1x is cached at all times".
  await db.icons.clear();
  await db.icons.put({ name, data, timestamp: Date.now() });
}

export async function getCachedIcon(name: string) {
  return await db.icons.get(name);
}

export async function getAnyCachedIcon() {
  return await db.icons.orderBy('timestamp').last();
}

// Storage Management
export async function initStorage() {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    console.log(`Storage persisted: ${isPersisted}`);
  }
  
  checkQuota();
}

export async function getVaultCapacityBytes(): Promise<number> {
  const capStr = await getSetting('vaultCapacity');
  const capMB = capStr ? parseInt(capStr, 10) : 500;
  return capMB * 1024 * 1024;
}

export async function checkQuota() {
  if (navigator.storage && navigator.storage.estimate) {
    const { usage, quota } = await navigator.storage.estimate();
    console.log(`Storage usage: ${usage} / ${quota}`);
    
    const maxBytes = await getVaultCapacityBytes();
    const pruneThreshold = 0.9 * maxBytes;

    if (usage && usage > pruneThreshold) {
      console.warn('Storage quota exceeded threshold, pruning old media...');
      await pruneOldMedia();
    }
    
    return { usage, quota, isFull: (usage || 0) > maxBytes };
  }
  return { usage: 0, quota: 0, isFull: false };
}

async function pruneOldMedia() {
  const maxBytes = await getVaultCapacityBytes();
  const targetUsage = 0.8 * maxBytes;
  let currentUsage = (await navigator.storage.estimate()).usage || 0;
  
  if (currentUsage <= targetUsage) return;

  // Get all media sorted by timestamp (oldest first)
  const allMedia = await db.media.orderBy('timestamp').toArray();
  
  for (const media of allMedia) {
    if (currentUsage <= targetUsage) break;
    
    await db.media.delete(media.id);
    currentUsage -= (media.size || 0);
  }
}

// Wrapper functions for backward compatibility with existing code
const cleanId = (obj: any) => {
  const cleaned = { ...obj };
  if (cleaned.id === undefined) delete cleaned.id;
  return cleaned;
};

export const getSetting = async (key: string) => (await db.settings.get(key))?.value;
export const setSetting = async (key: string, value: any) => db.settings.put({ key, value });

export const addMessage = async (msg: any) => db.messages.put(cleanId(msg));
export const getMessages = async () => db.messages.orderBy('timestamp').toArray();
export const deleteMessage = async (id: string) => db.messages.delete(id);

export const addThread = async (t: any) => db.threads.put(cleanId(t));
export const getThreads = async () => db.threads.toArray();

export const addGroup = async (g: any) => db.groups.put(cleanId(g));
export const getGroups = async () => db.groups.toArray();

export const addContact = async (c: any) => db.contacts.put(cleanId(c));
export const getContacts = async () => db.contacts.toArray();

export const addAgent = async (a: any) => db.agents.put(cleanId(a));
export const getAgents = async () => db.agents.toArray();
export const deleteAgent = async (id: string) => db.agents.delete(id);

export const addRadixContact = async (c: any) => db.radixContacts.put(cleanId(c));
export const getRadixContacts = async () => db.radixContacts.toArray();
export const deleteRadixContact = async (id: number) => db.radixContacts.delete(id);

export const addWhatsappContact = async (c: any) => db.whatsappContacts.put(cleanId(c));
export const getWhatsappContacts = async () => db.whatsappContacts.toArray();
export const deleteWhatsappContact = async (id: number) => db.whatsappContacts.delete(id);

export const addWhatsappMessage = async (m: any) => db.whatsappMessages.put(cleanId(m));
export const getWhatsappMessages = async (contactId: number) => db.whatsappMessages.where('contactId').equals(contactId).sortBy('timestamp');
export const deleteWhatsappMessage = async (id: number) => db.whatsappMessages.delete(id);

// Media Helpers
export const saveMedia = async (blob: Blob, type: 'image' | 'video' | 'audio') => {
    const id = crypto.randomUUID();
    await db.media.put({
        id,
        timestamp: Date.now(),
        type,
        size: blob.size,
        data: blob // This will be encrypted by middleware
    });
    return id;
};

export const getMedia = async (id: string) => {
    const record = await db.media.get(id);
    return record?.data;
};

// File System Helpers
export const getFileIndex = async () => db.file_map.toArray();
export const getFileByPath = async (path: string) => db.file_map.get(path);
export const saveFileIndex = async (files: any[]) => db.file_map.bulkPut(files);
export const clearFileIndex = async () => db.file_map.clear();

export const saveDirectoryHandle = async (handle: FileSystemDirectoryHandle) => db.directory_handles.put({ id: 'root', handle });
export const getDirectoryHandle = async () => (await db.directory_handles.get('root'))?.handle;

// Channels Module Helpers
export const addFolder = async (folder: any) => db.folders.put(cleanId(folder));
export const getFolders = async () => db.folders.toArray();
export const deleteFolder = async (id: string) => db.folders.delete(id);
export const updateFolder = async (id: string, updates: any) => db.folders.update(id, updates);

export const addChannel = async (channel: any) => db.channels.put(cleanId(channel));
export const getChannels = async () => db.channels.toArray();
export const deleteChannel = async (id: string) => db.channels.delete(id);
export const updateChannel = async (id: string, updates: any) => db.channels.update(id, updates);

export const addFeed = async (feed: any) => db.feeds.put(cleanId(feed));
export const getFeeds = async () => db.feeds.toArray();
export const deleteFeed = async (id: string) => db.feeds.delete(id);

export const addChannelerPrompt = async (prompt: any) => db.channeler_prompts.put(cleanId(prompt));
export const getChannelerPrompts = async () => db.channeler_prompts.toArray();
export const deleteChannelerPrompt = async (id: string) => db.channeler_prompts.delete(id);

export const getStorageStats = async () => {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0
    };
  }
  return { usage: 0, quota: 0 };
};

export const evictOldMedia = async (totalCapacityBytes: number, force: boolean = false) => {
  const RESERVED_BYTES = 25 * 1024 * 1024;
  const BUFFER_BYTES = totalCapacityBytes * 0.15;
  const CEILING = totalCapacityBytes - RESERVED_BYTES - BUFFER_BYTES;

  const stats = await getStorageStats();
  let currentUsage = stats.usage;

  if (force || currentUsage > (totalCapacityBytes * 0.85)) {
    // We are in the eviction zone
    const mediaItems = await db.media.orderBy('timestamp').toArray();
    
    for (const item of mediaItems) {
      if (!force && currentUsage <= CEILING) break;
      if (force && currentUsage <= 0) break; // Evict all if forced, or maybe down to 0
      
      // Delete the oldest item
      await db.media.delete(item.id);
      
      // Estimate size reduction
      const size = item.size || (1024 * 1024); // fallback 1MB
      currentUsage -= size;
    }
  }
};

export const addAgentTelemetryLog = async (log: any) => {
  return db.agent_telemetry_logs.add({
    ...log,
    timestamp: Date.now()
  });
};

export const getAgentTelemetryLogs = async (agentId: string) => {
  return db.agent_telemetry_logs
    .where('agentId')
    .equals(agentId)
    .reverse()
    .sortBy('timestamp');
};

export const incrementExaApiUsage = async () => {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const record = await db.exa_api_usage.get(monthKey);
  if (record) {
    await db.exa_api_usage.update(monthKey, { count: record.count + 1 });
    return record.count + 1;
  } else {
    await db.exa_api_usage.put({ month: monthKey, count: 1 });
    return 1;
  }
};

export const getExaApiUsage = async () => {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const record = await db.exa_api_usage.get(monthKey);
  return record ? record.count : 0;
};
