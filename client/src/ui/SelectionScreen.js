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

// Map each stat to the exact Kenney bar mid-segment filename (barBlue uses a non-standard name)
const STAT_BAR_MID = {
  speed: 'barBlue_horizontalBlue',
  attack: 'barRed_horizontalMid',
  defense: 'barGreen_horizontalMid',
  bravery: 'barRed_horizontalMid',
  visibility: 'barYellow_horizontalMid',
  endurance: 'barGreen_horizontalMid',
  sociability: 'barYellow_horizontalMid',
  fertility: 'barBlue_horizontalBlue',
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
          display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
          width: 100%; height: 100%; pointer-events: auto;
          padding: 24px 16px; overflow-y: auto;
        }
        .sel-wrapper::-webkit-scrollbar { width: 8px; }
        .sel-wrapper::-webkit-scrollbar-track { background: #1a0f00; }
        .sel-wrapper::-webkit-scrollbar-thumb { background: #6b3a00; }

        .sel-title {
          font-size: 16px; color: #f5d67a; margin-bottom: 8px;
          text-shadow: 2px 2px 0 #6b3a00;
                 }
        .sel-subtitle { font-size: 7px; color: #c8a86c; margin-bottom: 24px; letter-spacing: 1px; }

        .archetype-row {
          display: flex; gap: 12px; margin-bottom: 24px;
          flex-wrap: wrap; justify-content: center;
        }
        .archetype-card {
          background: url('/assets/ui/panelInset_beige.png') center/100% 100% no-repeat;
          image-rendering: pixelated;
          padding: 14px 12px; width: 148px; text-align: center;
          cursor: pointer; transition: filter 0.1s; position: relative;
          border: 4px solid transparent;
          outline: 4px solid transparent;
        }
        .archetype-card:hover { filter: brightness(1.08); }
        .archetype-card.selected {
          outline: 4px solid #f5d67a;
          filter: brightness(1.1);
        }
        .archetype-card.confirmed { opacity: 0.55; pointer-events: none; }

        .arch-img {
          width: 72px; height: 72px; object-fit: contain; margin-bottom: 8px;
          image-rendering: pixelated;
        }
        .arch-name { font-size: 8px; color: #3d2200; margin-bottom: 2px; }
        .arch-role { font-size: 7px; color: #7a5230; margin-bottom: 10px; }

        .stat-row { display: flex; align-items: center; gap: 4px; margin-bottom: 4px; }
        .stat-label { font-size: 6px; color: #5a3a1a; width: 48px; text-align: right; text-transform: uppercase; }
        .rpg-bar-outer {
          flex: 1; height: 10px;
          background: url('/assets/ui/barBack_horizontalMid.png') repeat-x center / auto 10px;
          image-rendering: pixelated;
        }
        .rpg-bar-inner {
          height: 10px;
          image-rendering: pixelated;
        }

        .gene-section-title {
          font-size: 12px; color: #f5d67a; margin-bottom: 14px;
          text-shadow: 2px 2px 0 #6b3a00;
        }
        .gene-row {
          display: flex; gap: 12px; margin-bottom: 24px;
          flex-wrap: wrap; justify-content: center;
        }
        .gene-card {
          background: url('/assets/ui/panel_beige.png') center/100% 100% no-repeat;
          image-rendering: pixelated;
          padding: 18px 20px; width: 220px; cursor: pointer;
          transition: filter 0.1s;
          outline: 4px solid transparent;
          text-align: center;
        }
        .gene-card:hover { filter: brightness(1.06); }
        .gene-card.selected {
          outline: 4px solid #5b8dd9;
          filter: brightness(1.08);
        }
        .gene-card.confirmed { opacity: 0.55; pointer-events: none; }

        .gene-icon { font-size: 24px; margin-bottom: 8px; }
        .gene-name { font-size: 8px; color: #3d2200; margin-bottom: 6px; }
        .gene-desc { font-size: 6px; color: #7a5230; line-height: 2; }

        .confirm-btn {
          display: block; width: 280px; height: 49px;
          border: none; cursor: pointer;
          font-family: 'Press Start 2P', monospace; font-size: 9px;
                   background: url('/assets/ui/buttonLong_brown.png') center/100% 100% no-repeat;
          image-rendering: pixelated;
          color: #f5d67a;
          text-shadow: 1px 1px 0 #3d1a00;
          transition: filter 0.05s;
        }
        .confirm-btn:disabled { filter: brightness(0.5); cursor: not-allowed; }
        .confirm-btn:not(:disabled):active {
          background-image: url('/assets/ui/buttonLong_brown_pressed.png');
          padding-top: 4px;
        }
        .confirm-btn.confirmed-state {
          background-image: url('/assets/ui/buttonLong_grey.png');
          color: #aaa;
          text-shadow: none;
        }
        .launch-btn {
          display: none; width: 280px; height: 49px; margin-top: 10px;
          border: none; cursor: pointer;
          font-family: 'Press Start 2P', monospace; font-size: 9px;
                   background: url('/assets/ui/buttonLong_beige.png') center/100% 100% no-repeat;
          image-rendering: pixelated;
          color: #3d2200;
          text-shadow: 1px 1px 0 rgba(255,255,255,0.3);
        }
        .launch-btn:not(:disabled):active {
          background-image: url('/assets/ui/buttonLong_beige_pressed.png');
          padding-top: 4px;
        }
        .launch-btn:disabled { filter: brightness(0.5); cursor: not-allowed; }

        .other-selections {
          margin-top: 14px; font-size: 7px; color: #c8a86c; text-align: center;
          letter-spacing: 1px; line-height: 2;
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
                  <div class="rpg-bar-outer">
                    <div class="rpg-bar-inner" style="width:${val * 10}%; background: url('/assets/ui/${STAT_BAR_MID[key]}.png') repeat-x center / auto 10px;"></div>
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

        <button class="confirm-btn" id="confirm-btn" disabled>Confirm</button>
        ${isHost ? `<button class="launch-btn" id="launch-btn" disabled>Launch Game</button>` : ''}
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
      confirmBtn.textContent = 'Confirmed!';
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
