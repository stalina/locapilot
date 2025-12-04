import Peer from 'peerjs';

export type PeerStatus =
  | 'idle'
  | 'creating'
  | 'hosting'
  | 'client-connected'
  | 'connection-open'
  | 'connected'
  | 'importing'
  | 'error'
  | 'stopped';

export type OnDataCb = (data: any) => Promise<void> | void;
export type OnStatusCb = (status: PeerStatus, info?: any) => void;

export class PeerSyncService {
  private peer: any = null;
  private conn: any = null;
  private onData?: OnDataCb;
  private onStatus?: OnStatusCb;

  constructor(onData?: OnDataCb, onStatus?: OnStatusCb) {
    this.onData = onData;
    this.onStatus = onStatus;
  }

  private notify(status: PeerStatus, info?: any) {
    try {
      this.onStatus?.(status, info);
    } catch (e) {
      console.error('onStatus callback failed', e);
    }
  }

  async startHosting(id: string) {
    if (this.peer) return;
    this.notify('creating');
    this.peer = new Peer(id, { debug: 2 });

    this.peer.on('open', (peerId: string) => {
      this.notify('hosting', peerId);
    });

    this.peer.on('connection', (c: any) => {
      this.conn = c;
      this.notify('client-connected');

      this.conn.on('open', () => {
        this.notify('connection-open');
      });

      this.conn.on('close', () => {
        this.notify('stopped');
        this.conn = null;
      });

      this.conn.on('error', (err: any) => {
        this.notify('error', err);
      });
    });

    this.peer.on('error', (err: any) => {
      this.notify('error', err);
    });
  }

  stopHosting() {
    if (this.conn) {
      try {
        this.conn.close();
      } catch (e) {
        console.warn('conn.close failed', e);
      }
      this.conn = null;
    }
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (e) {
        console.warn('peer.destroy failed', e);
      }
      this.peer = null;
    }
    this.notify('stopped');
  }

  async connect(hostId: string) {
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (e) {
        console.warn('peer.destroy failed', e);
      }
      this.peer = null;
    }

    // create anonymous peer (let server assign id)
    this.peer = new Peer(undefined as any, { debug: 2 });

    this.peer.on('open', (id: string) => {
      this.notify('connected', id);
      this.conn = this.peer.connect(hostId);

      this.conn.on('open', () => {
        this.notify('connection-open');
      });

      this.conn.on('data', async (data: any) => {
        try {
          await this.onData?.(data);
        } catch (e) {
          console.error('onData handler failed', e);
        }
      });

      this.conn.on('error', (err: any) => {
        this.notify('error', err);
      });
    });

    this.peer.on('error', (err: any) => {
      this.notify('error', err);
    });
  }

  disconnect() {
    if (this.conn) {
      try {
        this.conn.close();
      } catch (e) {
        console.warn('conn.close failed', e);
      }
      this.conn = null;
    }
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (e) {
        console.warn('peer.destroy failed', e);
      }
      this.peer = null;
    }
    this.notify('stopped');
  }

  sendExport(json: string) {
    if (!this.conn || this.conn.open === false) {
      throw new Error('No open connection to send data');
    }
    try {
      this.conn.send({ type: 'export', payload: json });
    } catch (e) {
      console.error('sendExport failed', e);
      this.notify('error', e);
    }
  }
}

export default PeerSyncService;
