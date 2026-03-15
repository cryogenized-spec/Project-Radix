import { createLibp2p } from 'libp2p';
import { webRTC } from '@libp2p/webrtc';
import { webSockets } from '@libp2p/websockets';
import { noise } from '@libp2p/noise';
import { yamux } from '@libp2p/yamux';
import { bootstrap } from '@libp2p/bootstrap';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import { multiaddr } from '@multiformats/multiaddr';
import { storageManager } from './storage';

class NetworkManager {
  private node: any;
  private peers: Map<string, any> = new Map();
  private messageHandlers: ((msg: any) => void)[] = [];

  async init() {
    try {
        this.node = await createLibp2p({
          transports: [
            webRTC(),
            webSockets()
          ],
          connectionEncrypters: [noise()],
          streamMuxers: [yamux()],
          peerDiscovery: [
            bootstrap({
              list: [
                '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
                '/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa',
                '/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb',
                '/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt'
              ]
            })
          ],
          services: {
            pubsub: gossipsub() as any
          }
        });

        this.node.addEventListener('peer:discovery', (evt: any) => {
          const peer = evt.detail;
          // console.log('Discovered:', peer.id.toString());
          this.peers.set(peer.id.toString(), peer);
        });

        this.node.addEventListener('peer:connect', (evt: any) => {
          const peerId = evt.detail;
          // console.log('Connected to:', peerId.toString());
        });

        await this.node.start();
        console.log('libp2p node started with id:', this.node.peerId.toString());

        // Subscribe to global chat topic
        this.node.services.pubsub.subscribe('radix-global-chat');
        this.node.services.pubsub.addEventListener('message', async (evt: any) => {
          const msg = new TextDecoder().decode(evt.detail.data);
          try {
            const parsed = JSON.parse(msg);
            // Verify signature, decrypt if needed
            // For now, just pass through
            this.messageHandlers.forEach(handler => handler(parsed));
            await storageManager.saveMessage(parsed);
          } catch (e) {
            console.error('Failed to parse P2P message', e);
          }
        });
    } catch (err) {
        console.error("Failed to init libp2p", err);
    }
  }

  async broadcastMessage(message: any) {
    if (!this.node) await this.init();
    const msgString = JSON.stringify(message);
    const data = new TextEncoder().encode(msgString);
    await this.node.services.pubsub.publish('radix-global-chat', data);
  }

  onMessage(handler: (msg: any) => void) {
    this.messageHandlers.push(handler);
  }

  getPeerId() {
    return this.node?.peerId.toString();
  }
}

export const networkManager = new NetworkManager();
