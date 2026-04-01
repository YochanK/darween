/**
 * Lobby screen: enter username, create or join a room.
 */
export class LobbyScreen {
  constructor(socket, uiManager) {
    this.socket = socket;
    this.ui = uiManager;
  }

  render() {
    const container = document.createElement('div');
    container.style.cssText = 'position:relative;width:100%;height:100%;';

    // ── Procedural pixel map background ──────────────────────────────────
    const BG_W = 320, BG_H = 180;
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = BG_W;
    bgCanvas.height = BG_H;
    bgCanvas.style.cssText = `
      position: absolute; top: -5%; left: -5%; width: 110%; height: 110%;
      image-rendering: pixelated;
      filter: blur(3px) brightness(0.45) saturate(1.1);
      pointer-events: none;
      animation: bgDrift 40s ease-in-out infinite;
    `;
    this._drawMap(bgCanvas);
    container.appendChild(bgCanvas);

    // ── UI ────────────────────────────────────────────────────────────────
    const ui = document.createElement('div');
    ui.innerHTML = `
      <style>
        @keyframes bgDrift {
          0%, 100% { transform: translate(0, 0); }
          25%       { transform: translate(-1.5%, -1%); }
          75%       { transform: translate(1%, 0.8%); }
        }
        .lobby-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          pointer-events: auto;
          padding-top: 60px;
          position: relative;
        }
        .lobby-box {
          background: url('/assets/ui/panel_brown.png') center/100% 100% no-repeat;
          image-rendering: pixelated;
          padding: 52px 48px 44px;
          width: 460px;
          text-align: center;
        }
        .lobby-box h1 {
          font-size: 22px;
          margin-bottom: 10px;
          color: #f5d67a;
          text-shadow: 3px 3px 0 #6b3a00, -1px -1px 0 #6b3a00;
          line-height: 1.4;
        }
        .lobby-box .subtitle {
          font-size: 7px;
          color: #c8a86c;
          margin-bottom: 32px;
          line-height: 2;
        }
        .rpg-input-wrap {
          background: url('/assets/ui/panelInset_beige.png') center/100% 100% no-repeat;
          image-rendering: pixelated;
          padding: 10px 14px;
          margin-bottom: 14px;
        }
        .lobby-box input {
          width: 100%;
          border: none;
          background: transparent;
          color: #3d2200;
          font-size: 10px;
          font-family: 'Press Start 2P', monospace;
          outline: none;
          text-align: center;
        }
        .lobby-box input::placeholder { color: #9e7a50; }
        .lobby-divider {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 18px 0;
          color: #c8a86c;
          font-size: 7px;
        }
        .lobby-divider hr { flex: 1; border: none; border-top: 2px solid #6b3a00; }
        .rpg-btn {
          display: block;
          width: 100%;
          padding: 0;
          height: 49px;
          border: none;
          cursor: pointer;
          margin-bottom: 10px;
          font-family: 'Press Start 2P', monospace;
          font-size: 9px;
          color: #3d2200;
          background: url('/assets/ui/buttonLong_beige.png') center/100% 100% no-repeat;
          image-rendering: pixelated;
          transition: filter 0.05s;
        }
        .rpg-btn:active {
          background-image: url('/assets/ui/buttonLong_beige_pressed.png');
          padding-top: 4px;
        }
        .rpg-btn:disabled {
          filter: brightness(0.6);
          cursor: not-allowed;
        }
        .btn-create {
          background-image: url('/assets/ui/buttonLong_brown.png');
          color: #f5d67a;
          text-shadow: 1px 1px 0 #3d1a00;
        }
        .btn-create:active { background-image: url('/assets/ui/buttonLong_brown_pressed.png'); }
        .btn-join {
          background-image: url('/assets/ui/buttonLong_blue.png');
          color: #e8f4ff;
          text-shadow: 1px 1px 0 #001a3d;
        }
        .btn-join:active { background-image: url('/assets/ui/buttonLong_blue_pressed.png'); }
        .error-msg {
          color: #ff3333;
          font-size: 7px;
          margin-top: 10px;
          min-height: 18px;
          line-height: 2;
          text-shadow: 1px 1px 0 #000;
        }
      </style>
      <div class="lobby-wrapper">
        <div class="lobby-box">
          <h1>DARWEEN</h1>
          <div class="subtitle">Evolve. Compete. Dominate.</div>
          <div class="rpg-input-wrap">
            <input type="text" id="username-input" placeholder="Enter your name" maxlength="20" autocomplete="off" />
          </div>
          <button class="rpg-btn btn-create" id="create-btn">Create Room</button>
          <div class="lobby-divider"><hr><span>or join existing</span><hr></div>
          <div class="rpg-input-wrap">
            <input type="text" id="room-code-input" placeholder="Room code" maxlength="6" autocomplete="off" style="text-transform: uppercase; font-size: 13px;" />
          </div>
          <button class="rpg-btn btn-join" id="join-btn">Join Room</button>
          <div class="error-msg" id="lobby-error"></div>
        </div>
      </div>
    `;
    container.appendChild(ui);

    const usernameInput = container.querySelector('#username-input');
    const codeInput = container.querySelector('#room-code-input');
    const createBtn = container.querySelector('#create-btn');
    const joinBtn = container.querySelector('#join-btn');
    const errorEl = container.querySelector('#lobby-error');

    createBtn.addEventListener('click', () => {
      const username = usernameInput.value.trim();
      if (!username) { errorEl.textContent = 'Please enter your name'; return; }
      errorEl.textContent = '';
      createBtn.disabled = true;
      this.socket.send({ type: 'CREATE_ROOM', username });
    });

    joinBtn.addEventListener('click', () => {
      const username = usernameInput.value.trim();
      const code = codeInput.value.trim().toUpperCase();
      if (!username) { errorEl.textContent = 'Please enter your name'; return; }
      if (!code || code.length < 4) { errorEl.textContent = 'Please enter a valid room code'; return; }
      errorEl.textContent = '';
      joinBtn.disabled = true;
      this.socket.send({ type: 'JOIN_ROOM', username, room_code: code });
    });

    this.socket.on('ERROR', (msg) => {
      errorEl.textContent = msg.message;
      createBtn.disabled = false;
      joinBtn.disabled = false;
    });

    setTimeout(() => usernameInput.focus(), 100);

    return container;
  }

  /** Procedurally generate and draw a pixel-art terrain map onto the canvas. */
  _drawMap(canvas) {
    const W = canvas.width, H = canvas.height;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(W, H);

    // Random phase offsets so the map looks different each session
    const px = Math.random() * Math.PI * 2;
    const py = Math.random() * Math.PI * 2;

    // Terrain palette  [r, g, b]
    const DEEP_WATER    = [12,  42,  80];
    const WATER         = [22,  80, 140];
    const SHALLOW       = [38, 110, 160];
    const SAND          = [175, 152, 90];
    const GRASS_LIGHT   = [72, 128,  55];
    const GRASS         = [55, 105,  42];
    const FOREST        = [38,  80,  30];
    const DENSE_FOREST  = [25,  58,  22];
    const STONE         = [100,  92,  82];

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const nx = x / W, ny = y / H;

        // Layered sine-wave noise — gives smooth organic terrain
        let h = 0;
        h += Math.sin(nx * 8.4  + px)       * Math.cos(ny * 7.2  + py)       * 0.40;
        h += Math.sin(nx * 17.1 + py * 1.3) * Math.cos(ny * 15.3 + px * 0.7) * 0.28;
        h += Math.sin(nx * 33.7 + px * 2.1) * Math.cos(ny * 29.8 + py * 1.9) * 0.18;
        h += Math.sin(nx * 67.0 + py * 3.0) * Math.cos(ny * 61.0 + px * 2.5) * 0.09;
        h += Math.sin(nx * 130  + px * 4.2) * Math.cos(ny * 118  + py * 3.8) * 0.05;
        h = (h + 1) * 0.5; // → [0, 1]

        let col;
        if      (h < 0.30) col = DEEP_WATER;
        else if (h < 0.40) col = WATER;
        else if (h < 0.46) col = SHALLOW;
        else if (h < 0.50) col = SAND;
        else if (h < 0.58) col = GRASS_LIGHT;
        else if (h < 0.70) col = GRASS;
        else if (h < 0.82) col = FOREST;
        else if (h < 0.90) col = DENSE_FOREST;
        else               col = STONE;

        const i = (y * W + x) * 4;
        img.data[i]     = col[0];
        img.data[i + 1] = col[1];
        img.data[i + 2] = col[2];
        img.data[i + 3] = 255;
      }
    }

    ctx.putImageData(img, 0, 0);
  }
}
