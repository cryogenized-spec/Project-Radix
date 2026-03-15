import { getDirectoryHandle, saveDirectoryHandle, saveFileIndex, clearFileIndex, getFileByPath } from './db';

export class FileSystemManager {
  private rootHandle: FileSystemDirectoryHandle | null = null;

  async mount() {
    try {
      const isIframe = window.self !== window.top;
      if (!isIframe && 'showDirectoryPicker' in window) {
        // @ts-ignore - showDirectoryPicker is not yet in all TS definitions
        const handle = await window.showDirectoryPicker();
        this.rootHandle = handle;
        await saveDirectoryHandle(handle);
        return true;
      } else {
        console.warn('showDirectoryPicker not available or blocked in iframe');
        return false;
      }
    } catch (e) {
      console.error('Mount cancelled or failed', e);
      return false;
    }
  }

  async loadFromStorage() {
    const handle = await getDirectoryHandle();
    if (handle) {
      this.rootHandle = handle;
      return true;
    }
    return false;
  }

  async verifyPermission(readWrite = false): Promise<boolean> {
    if (!this.rootHandle) return false;
    
    const options: any = { mode: readWrite ? 'readwrite' : 'read' };
    
    // Check if permission was already granted
    if ((await (this.rootHandle as any).queryPermission(options)) === 'granted') {
      return true;
    }
    
    // Request permission
    if ((await (this.rootHandle as any).requestPermission(options)) === 'granted') {
      return true;
    }
    
    return false;
  }

  async index() {
    if (!this.rootHandle) throw new Error("No root handle");
    
    const files: any[] = [];
    
    // Recursive traversal
    const traverse = async (dirHandle: FileSystemDirectoryHandle, path = '') => {
      for await (const entry of (dirHandle as any).values()) {
        const entryPath = path ? `${path}/${entry.name}` : entry.name;
        
        if (entry.kind === 'file') {
          try {
            const file = await (entry as any).getFile();
            files.push({
              filePath: entryPath,
              fileName: entry.name,
              extension: entry.name.split('.').pop()?.toLowerCase() || '',
              lastModified: file.lastModified,
              handle: entry // Store handle for direct access
            });
          } catch (e) {
            console.warn(`Failed to access file: ${entryPath}`, e);
          }
        } else if (entry.kind === 'directory') {
          // Skip common ignore folders
          if (['.git', 'node_modules', 'dist', 'build', '.next', 'coverage'].includes(entry.name)) continue;
          
          try {
            await traverse(entry, entryPath);
          } catch (e) {
             console.warn(`Failed to access directory: ${entryPath}`, e);
          }
        }
      }
    };

    await traverse(this.rootHandle);
    
    // Atomic update
    await clearFileIndex();
    await saveFileIndex(files);
    
    return files.length;
  }

  async getFile(path: string): Promise<File | null> {
    const record = await getFileByPath(path);
    if (!record || !record.handle) return null;
    return await record.handle.getFile();
  }
  
  async getFileContent(path: string): Promise<string | null> {
      const file = await this.getFile(path);
      if (!file) return null;
      return await file.text();
  }
}

export const fsManager = new FileSystemManager();
