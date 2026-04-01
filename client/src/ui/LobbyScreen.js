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
}
