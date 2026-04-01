/**
 * WebSocket client wrapper with auto-reconnect.
 */
export class GameSocket {
  constructor() {
    this.ws = null;
    this.handlers = new Map();
    this._reconnectDelay = 1000;
    this._maxReconnectDelay = 10000;
    this._shouldReconnect = false;
  }

  /** Connect to the game server. */
  connect() {
    this._shouldReconnect = true;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host;
    const url = `${protocol}://${host}/ws`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this._reconnectDelay = 1000;
      this._emit('connected', {});
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this._emit(msg.type, msg);
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };

    this.ws.onclose = () => {
      this._emit('disconnected', {});
      if (this._shouldReconnect) {
        setTimeout(() => this.connect(), this._reconnectDelay);
        this._reconnectDelay = Math.min(this._reconnectDelay * 2, this._maxReconnectDelay);
      }
    };

    this.ws.onerror = () => {};
  }

  send(message) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  on(type, callback) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type).push(callback);
  }

  off(type, callback) {
    const handlers = this.handlers.get(type);
    if (handlers) {
      const idx = handlers.indexOf(callback);
      if (idx >= 0) handlers.splice(idx, 1);
    }
  }

  disconnect() {
    this._shouldReconnect = false;
    this.ws?.close();
  }

  _emit(type, data) {
    for (const handler of this.handlers.get(type) || []) {
      handler(data);
    }
  }
}
