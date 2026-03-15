import Peer, { DataConnection } from 'peerjs';
import { getSetting, setSetting } from './db';

// Simple event emitter for P2P events
type P2PEvent = 'message' | 'connection' | 'error' | 'disconnected';
type P2PCallback = (data: any) => void;

class P2PService {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private listeners: Map<P2PEvent, P2PCallback[]> = new Map();
  private myId: string = '';

  constructor() {
    this.listeners.set('message', []);
    this.listeners.set('connection', []);
    this.listeners.set('error', []);
    this.listeners.set('disconnected', []);
  }

  private initPromise: Promise<string> | null = null;

  async init(userId?: string): Promise<string> {
    if (this.peer && !this.peer.destroyed && this.myId) return this.myId;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise(async (resolve, reject) => {
      // Use provided userId or generate one if not provided
      // Clean userId to be peerjs compatible (alphanumeric)
      let cleanId = userId ? userId.replace(/[^a-zA-Z0-9]/g, '') : undefined;
      
      if (!cleanId) {
          // Try to load from settings
          const storedId = await getSetting('peer_id');
          if (storedId) {
              cleanId = storedId;
          }
      }

      // Initialize Peer
      // We use the default PeerJS cloud server for signaling
      const options = {
        debug: 0 // Disable internal logging to avoid console spam/overlays
      };
      
      this.peer = cleanId ? new Peer(cleanId, options) : new Peer(options);

      this.peer!.on('open', async (id) => {
        console.log('P2P: My peer ID is: ' + id);
        this.myId = id;
        // Save ID for next time
        await setSetting('peer_id', id);
        this.initPromise = null;
        resolve(id);
      });

      this.peer!.on('connection', (conn) => {
        console.log('P2P: Incoming connection from ' + conn.peer);
        this.setupConnection(conn);
        this.emit('connection', conn.peer);
      });

      this.peer!.on('error', (err: any) => {
        // Suppress "Lost connection to server" error from console if we are handling it
        const isConnectionLoss = 
            err.type === 'network' || 
            err.type === 'disconnected' || 
            err.type === 'server-error' || 
            err.type === 'socket-error' || 
            err.type === 'socket-closed' ||
            (err.message && err.message.includes('Lost connection to server'));

        if (isConnectionLoss) {
             console.warn('P2P Network Issue (Auto-reconnecting):', err.message);
             this.handleDisconnect();
             return; // Don't emit 'error' to UI if we are handling it
        }

        // Handle specific errors
        if (err.type === 'peer-unavailable') {
            // Peer not found, maybe offline
            console.warn('P2P Peer Unavailable:', err.message);
            this.emit('error', err);
        } else if (err.type === 'unavailable-id') {
            console.warn('P2P ID taken, generating a new one...');
            // If the ID is taken, we should clear it and try again
            // We can't easily retry from here without recreating the Peer object
            // But we can clear the setting so next reload works, and maybe reject the promise
            if (this.peer) {
                this.peer.destroy();
                this.peer = null;
            }
            this.initPromise = null;
            setSetting('peer_id', null).then(() => {
                reject(err);
            });
        } else {
            console.error('P2P Error:', err);
            this.emit('error', err);
            if (this.initPromise) {
                this.initPromise = null;
                reject(err);
            }
        }
      });

      this.peer!.on('disconnected', () => {
        console.log('P2P: Disconnected from signaling server');
        this.emit('disconnected', null);
        this.handleDisconnect();
      });
    });

    return this.initPromise;
  }

  private isReconnecting = false;

  private handleDisconnect() {
      if (!this.peer || this.peer.destroyed || this.isReconnecting) return;
      
      this.isReconnecting = true;
      console.log('P2P: Attempting to reconnect in 5s...');
      
      setTimeout(() => {
          if (this.peer && !this.peer.destroyed && this.peer.disconnected) {
              this.peer.reconnect();
          }
          this.isReconnecting = false;
      }, 5000); // Retry after 5 seconds
  }

  async connect(peerId: string): Promise<boolean> {
    if (!this.peer) return Promise.reject('P2P not initialized');
    if (this.connections.has(peerId)) return Promise.resolve(true);

    console.log('P2P: Connecting to ' + peerId);
    const conn = this.peer.connect(peerId, {
      reliable: true
    });

    return new Promise((resolve) => {
      conn.on('open', () => {
        console.log('P2P: Connected to ' + peerId);
        this.setupConnection(conn);
        resolve(true);
      });

      conn.on('error', (err) => {
        console.error('P2P Connection Error:', err);
        resolve(false);
      });
    });
  }

  private setupConnection(conn: DataConnection) {
    this.connections.set(conn.peer, conn);

    conn.on('data', (data) => {
      console.log('P2P: Received data', data);
      this.emit('message', { sender: conn.peer, data });
    });

    conn.on('close', () => {
      console.log('P2P: Connection closed: ' + conn.peer);
      this.connections.delete(conn.peer);
    });
    
    conn.on('error', (err) => {
        console.error('P2P Connection Error with ' + conn.peer, err);
        this.connections.delete(conn.peer);
    });
  }

  async sendMessage(peerId: string, message: any) {
    let conn = this.connections.get(peerId);
    if (!conn) {
      // Try to connect if not connected
      try {
        const connected = await this.connect(peerId);
        if (connected) {
          conn = this.connections.get(peerId);
        }
      } catch (err) {
        console.warn('P2P: Failed to connect before sending message', err);
        return false;
      }
    }

    if (conn && conn.open) {
      // Add metadata for styling
      const font = await getSetting('font') || 'JetBrains Mono';
      const payload = {
        ...message,
        font,
        timestamp: Date.now()
      };
      conn.send(payload);
      return true;
    } else {
      console.warn('P2P: Cannot send message, no connection to ' + peerId);
      return false;
    }
  }

  on(event: P2PEvent, callback: P2PCallback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.push(callback);
    }
  }

  off(event: P2PEvent, callback: P2PCallback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event)!;
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emit(event: P2PEvent, data: any) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach(cb => cb(data));
    }
  }

  getId() {
    return this.myId;
  }
  
  disconnect() {
      if (this.peer) {
          this.peer.disconnect();
          this.peer.destroy();
          this.peer = null;
          this.connections.clear();
      }
  }
}

export const p2pService = new P2PService();
