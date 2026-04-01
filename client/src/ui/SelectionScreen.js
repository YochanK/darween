/**
 * Archetype and gene selection screen with stat gauges.
 */

const ARCHETYPES = [
  {
    id: 'fox', name: 'Fox', role: 'Scout', preview: '/assets/previews/animal-fox.png',
    stats: { speed: 8, attack: 4, defense: 3, bravery: 4, visibility: 9, endurance: 5, sociability: 4, fertility: 5 },
  },
  {
    id: 'lion', name: 'Lion', role: 'Warrior', preview: '/assets/previews/animal-lion.png',
    stats: { speed: 5, attack: 8, defense: 5, bravery: 9, visibility: 5, endurance: 6, sociability: 4, fertility: 3 },
  },
  {
    id: 'bunny', name: 'Bunny', role: 'Breeder', preview: '/assets/previews/animal-bunny.png',
    stats: { speed: 7, attack: 2, defense: 3, bravery: 2, visibility: 5, endurance: 4, sociability: 5, fertility: 9 },
  },
  {
    id: 'elephant', name: 'Elephant', role: 'Tank', preview: '/assets/previews/animal-elephant.png',
    stats: { speed: 3, attack: 5, defense: 9, bravery: 6, visibility: 4, endurance: 9, sociability: 5, fertility: 3 },
  },
  {
    id: 'monkey', name: 'Monkey', role: 'Social', preview: '/assets/previews/animal-monkey.png',
    stats: { speed: 6, attack: 5, defense: 5, bravery: 5, visibility: 6, endurance: 6, sociability: 9, fertility: 6 },
  },
];

const GENES = [
  { id: 'sugar_rush', name: 'Sugar Rush', icon: '⚡', description: 'Eating an apple gives +50% speed for 3 seconds' },
  { id: 'predator_instinct', name: 'Predator Instinct', icon: '🦷', description: 'Killing an enemy grants +1 food' },
  { id: 'aquatic_adaptation', name: 'Aquatic Adaptation', icon: '🌊', description: 'Move at normal speed in water' },
];

const STAT_COLORS = {
  speed: '#44bbff', attack: '#ff5555', defense: '#44dd66',
  bravery: '#ff8844', visibility: '#ffcc44', endurance: '#aa88ff',
  sociability: '#ff88cc', fertility: '#88ffcc',
};

export class SelectionScreen {
  constructor(socket, uiManager) {
    this.socket = socket;
    this.ui = uiManager;
    this.selectedArchetype = null;
    this.selectedGene = null;
    this.confirmed = false;
    this.otherPlayers = {};
  }

  render({ isHost }) {
    this.isHost = isHost;
    const container = document.createElement('div');
    container.innerHTML = `
      <style>
        .sel-wrapper {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          width: 100%; height: 100%; pointer-events: auto; padding: 20px; overflow-y: auto;
        }
        .sel-title { font-size: 28px; font-weight: 700; color: #ffcc44; margin-bottom: 6px; }
        .sel-subtitle { font-size: 14px; color: #888; margin-bottom: 24px; }
        .archetype-row { display: flex; gap: 14px; margin-bottom: 28px; flex-wrap: wrap; justify-content: center; }
        .archetype-card {
          background: rgba(30, 30, 60, 0.95); border: 3px solid transparent;
          border-radius: 16px; padding: 16px; width: 155px; text-align: center;
          cursor: pointer; transition: all 0.15s; position: relative;
        }
        .archetype-card:hover { border-color: #555; transform: translateY(-3px); }
        .archetype-card.selected { border-color: #ffcc44; background: rgba(50, 45, 30, 0.95); }
        .archetype-card.confirmed { opacity: 0.6; pointer-events: none; }
        .arch-img { width: 80px; height: 80px; object-fit: contain; margin-bottom: 8px; image-rendering: pixelated; }
        .arch-name { font-size: 16px; font-weight: 700; color: #fff; }
        .arch-role { font-size: 12px; color: #999; margin-bottom: 10px; }
        .stat-row { display: flex; align-items: center; gap: 4px; margin-bottom: 3px; }
        .stat-label { font-size: 10px; color: #aaa; width: 52px; text-align: right; text-transform: uppercase; }
        .stat-bar-bg { flex: 1; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; }
        .stat-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
        .gene-section-title { font-size: 18px; font-weight: 600; color: #fff; margin-bottom: 12px; }
        .gene-row { display: flex; gap: 14px; margin-bottom: 28px; flex-wrap: wrap; justify-content: center; }
        .gene-card {
          background: rgba(30, 30, 60, 0.95); border: 3px solid transparent;
          border-radius: 14px; padding: 16px 20px; width: 240px; cursor: pointer; transition: all 0.15s;
        }
        .gene-card:hover { border-color: #555; }
        .gene-card.selected { border-color: #44bbff; background: rgba(30, 40, 60, 0.95); }
        .gene-card.confirmed { opacity: 0.6; pointer-events: none; }
        .gene-icon { font-size: 28px; margin-bottom: 6px; }
        .gene-name { font-size: 15px; font-weight: 600; color: #fff; margin-bottom: 4px; }
        .gene-desc { font-size: 12px; color: #999; line-height: 1.4; }
        .confirm-btn {
          padding: 14px 48px; border: none; border-radius: 12px; font-size: 16px;
          font-weight: 600; cursor: pointer; transition: all 0.15s;
          background: linear-gradient(135deg, #44dd66, #22aa44); color: #fff;
        }
        .confirm-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .confirm-btn:not(:disabled):hover { transform: scale(1.03); }
        .confirm-btn.confirmed-state { background: #555; color: #aaa; }
        .other-selections {
          margin-top: 16px; font-size: 13px; color: #666; text-align: center;
        }
      </style>
      <div class="sel-wrapper">
        <div class="sel-title">Choose Your Species</div>
        <div class="sel-subtitle">Pick an archetype and a gene for your creatures</div>

        <div class="archetype-row" id="archetype-row">
          ${ARCHETYPES.map(a => `
            <div class="archetype-card" data-id="${a.id}">
              <img class="arch-img" src="${a.preview}" alt="${a.name}" />
              <div class="arch-name">${a.name}</div>
              <div class="arch-role">${a.role}</div>
              ${Object.entries(a.stats).map(([key, val]) => `
                <div class="stat-row">
                  <span class="stat-label">${key}</span>
                  <div class="stat-bar-bg">
                    <div class="stat-bar-fill" style="width:${val * 10}%; background:${STAT_COLORS[key] || '#888'}"></div>
                  </div>
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>

        <div class="gene-section-title">Choose a Gene</div>
        <div class="gene-row" id="gene-row">
          ${GENES.map(g => `
            <div class="gene-card" data-id="${g.id}">
              <div class="gene-icon">${g.icon}</div>
              <div class="gene-name">${g.name}</div>
              <div class="gene-desc">${g.description}</div>
            </div>
          `).join('')}
        </div>

        <button class="confirm-btn" id="confirm-btn" disabled>Confirm Selection</button>
        ${isHost ? `<button class="confirm-btn" id="launch-btn" disabled style="margin-top:12px; background:linear-gradient(135deg,#ffcc44,#ff9900); color:#1a1a2e; display:none;">Launch Game</button>` : ''}
        <div class="other-selections" id="other-selections"></div>
      </div>
    `;

    const confirmBtn = container.querySelector('#confirm-btn');

    // Archetype selection
    container.querySelectorAll('.archetype-card').forEach(card => {
      card.addEventListener('click', () => {
        if (this.confirmed) return;
        container.querySelectorAll('.archetype-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedArchetype = card.dataset.id;
        this.socket.send({ type: 'SELECT_ARCHETYPE', archetype: this.selectedArchetype });
        this._updateConfirmBtn(confirmBtn);
      });
    });

    // Gene selection
    container.querySelectorAll('.gene-card').forEach(card => {
      card.addEventListener('click', () => {
        if (this.confirmed) return;
        container.querySelectorAll('.gene-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedGene = card.dataset.id;
        this.socket.send({ type: 'SELECT_GENE', gene: this.selectedGene });
        this._updateConfirmBtn(confirmBtn);
      });
    });

    // Confirm
    confirmBtn.addEventListener('click', () => {
      if (!this.selectedArchetype || !this.selectedGene || this.confirmed) return;
      this.confirmed = true;
      confirmBtn.textContent = 'Confirmed ✓';
      confirmBtn.classList.add('confirmed-state');
      confirmBtn.disabled = true;
      container.querySelectorAll('.archetype-card, .gene-card').forEach(c => c.classList.add('confirmed'));
      this.socket.send({ type: 'CONFIRM_SELECTION' });
    });

    // Launch button (host only)
    const launchBtn = container.querySelector('#launch-btn');
    if (launchBtn) {
      launchBtn.addEventListener('click', () => {
        this.socket.send({ type: 'START_GAME' });
      });
    }

    // Track other player selections
    this._onSelectionUpdate = (msg) => {
      this.otherPlayers[msg.player_id] = msg;
      this._renderOtherSelections(container.querySelector('#other-selections'));
      // Show launch button when all confirmed
      if (launchBtn) {
        const allConfirmed = Object.values(this.otherPlayers).every(p => p.confirmed);
        if (allConfirmed && Object.keys(this.otherPlayers).length > 0) {
          launchBtn.style.display = 'block';
          launchBtn.disabled = false;
        }
      }
    };
    this.socket.on('SELECTION_UPDATE', this._onSelectionUpdate);

    return container;
  }

  _updateConfirmBtn(btn) {
    btn.disabled = !this.selectedArchetype || !this.selectedGene;
  }

  _renderOtherSelections(el) {
    const entries = Object.values(this.otherPlayers);
    const confirmedCount = entries.filter(p => p.confirmed).length;
    el.textContent = `${confirmedCount}/${entries.length} players confirmed`;
  }

  hide() {
    if (this._onSelectionUpdate) this.socket.off('SELECTION_UPDATE', this._onSelectionUpdate);
  }
}
