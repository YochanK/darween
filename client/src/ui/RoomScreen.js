/**
 * Room waiting screen: shows player list, room code, host controls.
 */
export class RoomScreen {
  constructor(socket, uiManager) {
    this.socket = socket;
    this.ui = uiManager;
    this.players = [];
    this.roomCode = '';
    this.playerId = '';
    this.isHost = false;
    this.listEl = null;
  }

  render({ roomCode, playerId, players, isHost }) {
    this.roomCode = roomCode;
    this.playerId = playerId;
    this.players = players || [];
    this.isHost = isHost;

    const container = document.createElement('div');
    container.innerHTML = `
      <style>
        .room-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          pointer-events: auto;
        }
        .room-box {
          background: url('/assets/ui/panel_brown.png') center/100% 100% no-repeat;
          image-rendering: pixelated;
          padding: 44px 44px 40px;
          width: 480px;
          text-align: center;
        }
        .room-code-label {
          font-size: 7px;
          color: #c8a86c;
          margin-bottom: 8px;
        }
        .room-code-wrap {
          background: url('/assets/ui/panelInset_beige.png') center/100% 100% no-repeat;
          image-rendering: pixelated;
          padding: 12px 20px;
          margin-bottom: 6px;
          cursor: pointer;
        }
        .room-code {
          font-size: 28px;
          letter-spacing: 8px;
          color: #3d2200;
        }
        .copy-hint {
          font-size: 7px;
          color: #9e7a50;
          margin-bottom: 20px;
          margin-top: 4px;
        }
        .player-count {
          font-size: 7px;
          color: #c8a86c;
          margin-bottom: 10px;
        }
        .player-list {
          list-style: none;
          padding: 0;
          margin: 0 0 20px;
          max-height: 280px;
          overflow-y: auto;
          text-align: left;
        }
        .player-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: url('/assets/ui/panelInset_beigeLight.png') center/100% 100% no-repeat;
          image-rendering: pixelated;
          margin-bottom: 6px;
          font-size: 8px;
          color: #3d2200;
        }
        .player-dot {
          width: 10px; height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
          outline: 2px solid rgba(0,0,0,0.3);
        }
        .player-name { flex: 1; }
        .host-badge {
          font-size: 7px;
          background: #f5d67a;
          color: #3d1a00;
          padding: 2px 6px;
          border: 2px solid #6b3a00;
        }
        .you-badge {
          font-size: 7px;
          background: #5b8dd9;
          color: #e8f4ff;
          padding: 2px 6px;
          border: 2px solid #1a3d6b;
        }
        .waiting-text {
          font-size: 8px;
          color: #c8a86c;
          padding: 16px;
          line-height: 2;
        }
        .rpg-btn {
          display: block;
          width: 100%;
          padding: 0;
          height: 49px;
          border: none;
          cursor: pointer;
          font-family: 'Press Start 2P', monospace;
          font-size: 9px;
          background: url('/assets/ui/buttonLong_brown.png') center/100% 100% no-repeat;
          image-rendering: pixelated;
          color: #f5d67a;
          text-shadow: 1px 1px 0 #3d1a00;
        }
        .rpg-btn:active {
          background-image: url('/assets/ui/buttonLong_brown_pressed.png');
          padding-top: 4px;
        }
        .rpg-btn:disabled {
          filter: brightness(0.6);
          cursor: not-allowed;
        }
      </style>
      <div class="room-wrapper">
        <div class="room-box">
          <div class="room-code-label">ROOM CODE</div>
          <div class="room-code-wrap" id="room-code-display">
            <div class="room-code">${this.roomCode}</div>
          </div>
          <div class="copy-hint" id="copy-hint">Click to copy</div>
          <div class="player-count" id="player-count">${this.players.length} player${this.players.length !== 1 ? 's' : ''}</div>
          <ul class="player-list" id="player-list"></ul>
          ${this.isHost
            ? `<button class="rpg-btn" id="start-btn">Start Game</button>`
            : `<div class="waiting-text">Waiting for host...</div>`
          }
        </div>
      </div>
    `;

    this.listEl = container.querySelector('#player-list');
    this._renderPlayers();

    // Copy room code
    const codeEl = container.querySelector('#room-code-display');
    const hintEl = container.querySelector('#copy-hint');
    codeEl.addEventListener('click', async () => {
      await navigator.clipboard.writeText(this.roomCode);
      hintEl.textContent = 'Copied!';
      setTimeout(() => { hintEl.textContent = 'Click to copy'; }, 2000);
    });

    // Start button (host only)
    if (this.isHost) {
      const startBtn = container.querySelector('#start-btn');
      startBtn.addEventListener('click', () => {
        this.socket.send({ type: 'START_GAME' });
      });
    }

    // Listen for player updates
    this._onJoin = (msg) => {
      this.players.push(msg);
      this._renderPlayers();
      container.querySelector('#player-count').textContent =
        `${this.players.length} player${this.players.length !== 1 ? 's' : ''}`;
    };
    this._onLeave = (msg) => {
      this.players = this.players.filter(p => p.player_id !== msg.player_id);
      this._renderPlayers();
      container.querySelector('#player-count').textContent =
        `${this.players.length} player${this.players.length !== 1 ? 's' : ''}`;
    };
    this.socket.on('PLAYER_JOINED', this._onJoin);
    this.socket.on('PLAYER_LEFT', this._onLeave);

    return container;
  }

  _renderPlayers() {
    if (!this.listEl) return;
    const TEAM_COLORS = [
      '#ff4444','#4488ff','#44dd66','#ffcc44','#ff88cc',
      '#88ffff','#ff8844','#aa88ff','#88ff88','#ffff44',
      '#ff4488','#44ffcc','#ff6644','#4444ff','#ccff44',
      '#ff44ff','#44ccff','#88ff44','#ff8888','#44ff88',
    ];
    this.listEl.innerHTML = this.players.map((p, i) => `
      <li class="player-item">
        <span class="player-dot" style="background:${TEAM_COLORS[i % TEAM_COLORS.length]}"></span>
        <span class="player-name">${this._escapeHtml(p.username)}</span>
        ${p.is_host ? '<span class="host-badge">HOST</span>' : ''}
        ${p.player_id === this.playerId ? '<span class="you-badge">YOU</span>' : ''}
      </li>
    `).join('');
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  hide() {
    if (this._onJoin) this.socket.off('PLAYER_JOINED', this._onJoin);
    if (this._onLeave) this.socket.off('PLAYER_LEFT', this._onLeave);
  }
}
