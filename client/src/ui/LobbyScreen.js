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

    const ui = document.createElement('div');
    ui.innerHTML = `
      <style>
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
        .github-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 14px;
          padding: 6px 14px;
          color: #f5d67a;
          font-size: 7px;
          text-decoration: none;
          border: 2px solid #f5d67a;
          border-radius: 4px;
          background: rgba(0,0,0,0.4);
          transition: background 0.15s, color 0.15s;
          text-shadow: 1px 1px 0 #3d1a00;
        }
        .github-badge:hover {
          background: rgba(0,0,0,0.6);
          color: #fff;
          border-color: #fff;
        }
        .github-badge svg {
          width: 14px;
          height: 14px;
          fill: currentColor;
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
          <a class="github-badge" href="https://github.com/YochanK/darween" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 16 16"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
            Evolve us on GitHub
          </a>
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
}
