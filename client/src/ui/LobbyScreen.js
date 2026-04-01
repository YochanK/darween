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
    container.innerHTML = `
      <style>
        .lobby-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          pointer-events: auto;
        }
        .lobby-box {
          background: rgba(20, 20, 50, 0.95);
          border-radius: 20px;
          padding: 48px;
          width: 420px;
          text-align: center;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        }
        .lobby-box h1 {
          font-size: 42px;
          margin-bottom: 8px;
          color: #ffcc44;
          text-shadow: 2px 2px 0 #c49000;
          letter-spacing: 3px;
        }
        .lobby-box .subtitle {
          font-size: 14px;
          color: #888;
          margin-bottom: 32px;
        }
        .lobby-box input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #444;
          border-radius: 10px;
          background: #1a1a30;
          color: #fff;
          font-size: 16px;
          outline: none;
          margin-bottom: 16px;
          text-align: center;
        }
        .lobby-box input:focus { border-color: #ffcc44; }
        .lobby-box input::placeholder { color: #666; }
        .lobby-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 20px 0;
          color: #555;
          font-size: 13px;
        }
        .lobby-divider hr { flex: 1; border: none; border-top: 1px solid #333; }
        .lobby-btn {
          width: 100%;
          padding: 14px;
          border: none;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          margin-bottom: 12px;
          transition: transform 0.1s, opacity 0.15s;
        }
        .lobby-btn:active { transform: scale(0.97); }
        .lobby-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-create {
          background: linear-gradient(135deg, #ffcc44, #ff9900);
          color: #1a1a2e;
        }
        .btn-join {
          background: linear-gradient(135deg, #4488ff, #2266dd);
          color: #fff;
        }
        .error-msg {
          color: #ff5555;
          font-size: 13px;
          margin-top: 8px;
          min-height: 20px;
        }
      </style>
      <div class="lobby-wrapper">
        <div class="lobby-box">
          <h1>DARWEEN</h1>
          <div class="subtitle">Evolve. Compete. Dominate.</div>
          <input type="text" id="username-input" placeholder="Enter your name" maxlength="20" autocomplete="off" />
          <button class="lobby-btn btn-create" id="create-btn">Create Room</button>
          <div class="lobby-divider"><hr><span>or join existing</span><hr></div>
          <input type="text" id="room-code-input" placeholder="Enter room code" maxlength="6" autocomplete="off" style="text-transform: uppercase; letter-spacing: 4px; font-size: 20px;" />
          <button class="lobby-btn btn-join" id="join-btn">Join Room</button>
          <div class="error-msg" id="lobby-error"></div>
        </div>
      </div>
    `;

    const usernameInput = container.querySelector('#username-input');
    const codeInput = container.querySelector('#room-code-input');
    const createBtn = container.querySelector('#create-btn');
    const joinBtn = container.querySelector('#join-btn');
    const errorEl = container.querySelector('#lobby-error');

    createBtn.addEventListener('click', () => {
      const username = usernameInput.value.trim();
      if (!username) {
        errorEl.textContent = 'Please enter your name';
        return;
      }
      errorEl.textContent = '';
      createBtn.disabled = true;
      this.socket.send({ type: 'CREATE_ROOM', username });
    });

    joinBtn.addEventListener('click', () => {
      const username = usernameInput.value.trim();
      const code = codeInput.value.trim().toUpperCase();
      if (!username) {
        errorEl.textContent = 'Please enter your name';
        return;
      }
      if (!code || code.length < 4) {
        errorEl.textContent = 'Please enter a valid room code';
        return;
      }
      errorEl.textContent = '';
      joinBtn.disabled = true;
      this.socket.send({ type: 'JOIN_ROOM', username, room_code: code });
    });

    // Listen for errors to re-enable buttons
    this.socket.on('ERROR', (msg) => {
      errorEl.textContent = msg.message;
      createBtn.disabled = false;
      joinBtn.disabled = false;
    });

    // Auto-focus username
    setTimeout(() => usernameInput.focus(), 100);

    return container;
  }
}
