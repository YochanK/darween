/**
 * In-game HUD overlay: timer, population, phase indicator, leaderboard.
 */
export class GameHUD {
  constructor(container) {
    this.el = document.createElement('div');
    this.el.id = 'game-hud';
    this.el.innerHTML = `
      <style>
        #game-hud {
          pointer-events: none;
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          font-family: 'Press Start 2P', monospace;
          color: #fff;
          image-rendering: pixelated;
        }
        #game-hud > * { pointer-events: auto; }

        /* ── Top-left: phase box ── */
        .hud-phase-box {
          position: absolute; top: 12px; left: 12px;
          background: url('/assets/ui/panelInset_beige.png') center/100% 100% no-repeat;
          image-rendering: pixelated;
          padding: 10px 16px;
          display: flex; align-items: center; gap: 12px;
          min-width: 180px;
        }
        .phase-icon {
          font-size: 20px;
          line-height: 1;
        }
        .phase-info { display: flex; flex-direction: column; gap: 4px; }
        .phase-label { font-size: 7px; color: #7a5230; }
        .phase-timer { font-size: 14px; color: #3d2200; }
        .turn-label { font-size: 6px; color: #9e7a50; }

        /* ── Speed controls ── */
        .speed-controls {
          display: flex; align-items: center; gap: 3px;
        }
        .speed-btn {
          background: url('/assets/ui/buttonSquare_beige.png') center/100% 100% no-repeat;
          image-rendering: pixelated;
          border: none;
          color: #5a3a1a;
          cursor: pointer;
          font-family: 'Press Start 2P', monospace;
          font-size: 6px;
          width: 28px; height: 28px;
          padding: 0;
        }
        .speed-btn:active {
          background-image: url('/assets/ui/buttonSquare_beige_pressed.png');
          padding-top: 2px;
        }
        .speed-btn.active {
          background-image: url('/assets/ui/buttonSquare_brown.png');
          color: #f5d67a;
        }
        .speed-btn.active:active {
          background-image: url('/assets/ui/buttonSquare_brown_pressed.png');
        }

        /* ── Top-right: my population ── */
        .hud-my-team {
          position: absolute; top: 12px; right: 12px;
          background: url('/assets/ui/panelInset_beige.png') center/100% 100% no-repeat;
          image-rendering: pixelated;
          padding: 10px 20px;
          text-align: center;
          min-width: 120px;
        }
        .my-pop { font-size: 22px; color: #3d2200; }
        .my-pop-label { font-size: 6px; color: #7a5230; margin-top: 4px; }

        /* ── Leaderboard ── */
        .hud-leaderboard {
          position: absolute; top: 90px; right: 12px;
          background: url('/assets/ui/panel_brown.png') center/100% 100% no-repeat;
          image-rendering: pixelated;
          padding: 16px 18px;
          min-width: 200px;
          max-height: 280px; overflow-y: auto;
        }
        .hud-leaderboard::-webkit-scrollbar { width: 6px; }
        .hud-leaderboard::-webkit-scrollbar-track { background: #6b3a00; }
        .hud-leaderboard::-webkit-scrollbar-thumb { background: #f5d67a; }
        .lb-title {
          font-size: 7px; color: #f5d67a;
          margin-bottom: 10px; text-shadow: 1px 1px 0 #3d1a00;
        }
        .lb-row {
          display: flex; align-items: center; gap: 8px;
          padding: 5px 0; font-size: 7px; color: #c8a86c;
          border-bottom: 1px solid rgba(245,214,122,0.15);
        }
        .lb-row:last-child { border-bottom: none; }
        .lb-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; outline: 1px solid rgba(0,0,0,0.4); }
        .lb-name { flex: 1; }
        .lb-pop { color: #f5d67a; text-shadow: 1px 1px 0 #3d1a00; }
        .lb-you .lb-name { color: #f5d67a; }

        /* ── Bottom stats bar ── */
        .hud-bottom-bar {
          position: absolute; bottom: 0; left: 0; right: 0;
          background: url('/assets/ui/panelInset_brown.png') center/100% 100% no-repeat;
          image-rendering: pixelated;
          padding: 10px 24px;
          display: flex; justify-content: center; gap: 32px;
          font-size: 7px; color: #c8a86c;
        }
        .hud-stat { display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .hud-stat-val { font-size: 10px; color: #f5d67a; text-shadow: 1px 1px 0 #3d1a00; }
        .hud-stat-label { font-size: 6px; color: #9e7a50; }
      </style>

      <div class="hud-phase-box">
        <div class="phase-icon" id="hud-phase-icon">☀</div>
        <div class="phase-info">
          <div class="phase-label" id="hud-phase-label">DAY</div>
          <div class="phase-timer" id="hud-timer">2:00</div>
          <div class="turn-label" id="hud-turn">Turn 1</div>
        </div>
        <div class="speed-controls" id="hud-speed-controls">
          <button class="speed-btn active" data-speed="1">1×</button>
          <button class="speed-btn" data-speed="2">2×</button>
          <button class="speed-btn" data-speed="4">4×</button>
          <button class="speed-btn" data-speed="8">8×</button>
          <button class="speed-btn" data-speed="16">16×</button>
        </div>
      </div>

      <div class="hud-my-team">
        <div class="my-pop" id="hud-my-pop">5</div>
        <div class="my-pop-label">Population</div>
      </div>

      <div class="hud-leaderboard" id="hud-leaderboard">
        <div class="lb-title">Leaderboard</div>
        <div id="hud-lb-rows"></div>
      </div>

      <div class="hud-bottom-bar" id="hud-bottom-bar"></div>
    `;
    container.appendChild(this.el);

    this.phaseIcon = this.el.querySelector('#hud-phase-icon');
    this.phaseLabel = this.el.querySelector('#hud-phase-label');
    this.turnLabel = this.el.querySelector('#hud-turn');
    this.timer = this.el.querySelector('#hud-timer');
    this.myPop = this.el.querySelector('#hud-my-pop');
    this.lbRows = this.el.querySelector('#hud-lb-rows');
    this.bottomBar = this.el.querySelector('#hud-bottom-bar');
    this.speedControls = this.el.querySelector('#hud-speed-controls');

    /** Set by main.js — called when player clicks a speed button. */
    this.onSpeedChange = null;

    this.speedControls.addEventListener('click', (e) => {
      const btn = e.target.closest('.speed-btn');
      if (!btn) return;
      const speed = parseFloat(btn.dataset.speed);
      if (this.onSpeedChange) this.onSpeedChange(speed);
    });
  }

  /**
   * Highlight the active speed button. Called when server confirms speed.
   * @param {number} speed
   */
  setSpeed(speed) {
    for (const btn of this.speedControls.querySelectorAll('.speed-btn')) {
      btn.classList.toggle('active', parseFloat(btn.dataset.speed) === speed);
    }
  }

  /**
   * Update HUD with latest game state.
   */
  update(data, myPlayerId, teamsData) {
    const phase = data.phase || 'DAY';
    const timeInPhase = data.time_in_phase || 0;
    const turnNumber = data.turn_number || 1;
    const teamStats = data.team_stats || {};

    // Phase icon
    if (phase === 'DAY') {
      this.phaseIcon.textContent = '☀';
      this.phaseLabel.textContent = 'DAY';
      const remaining = Math.max(0, 120 - timeInPhase);
      this.timer.textContent = this._formatTime(remaining);
    } else {
      this.phaseIcon.textContent = '🌙';
      this.phaseLabel.textContent = 'NIGHT';
      const remaining = Math.max(0, 20 - timeInPhase);
      this.timer.textContent = this._formatTime(remaining);
    }

    this.turnLabel.textContent = `Turn ${turnNumber}`;

    // My population
    const myStats = teamStats[myPlayerId];
    this.myPop.textContent = myStats?.population ?? '?';

    // Leaderboard
    const TEAM_COLORS = [
      '#ff4444','#4488ff','#44dd66','#ffcc44','#ff88cc',
      '#88ffff','#ff8844','#aa88ff','#88ff88','#ffff44',
      '#ff4488','#44ffcc','#ff6644','#4444ff','#ccff44',
      '#ff44ff','#44ccff','#88ff44','#ff8888','#44ff88',
    ];

    const entries = Object.entries(teamStats).map(([tid, stats]) => ({
      tid,
      pop: stats.population || 0,
      name: teamsData[tid]?.username || 'Unknown',
      colorIndex: teamsData[tid]?.color_index ?? 0,
      isMe: tid === myPlayerId,
    }));
    entries.sort((a, b) => b.pop - a.pop);

    this.lbRows.innerHTML = entries.map((e, i) => `
      <div class="lb-row ${e.isMe ? 'lb-you' : ''}">
        <span class="lb-dot" style="background:${TEAM_COLORS[e.colorIndex % TEAM_COLORS.length]}"></span>
        <span class="lb-name">${i + 1}. ${this._esc(e.name)}${e.isMe ? ' ★' : ''}</span>
        <span class="lb-pop">${e.pop}</span>
      </div>
    `).join('');

    // Bottom bar stats
    if (myStats) {
      this.bottomBar.innerHTML = `
        <div class="hud-stat"><div class="hud-stat-val">${myStats.births || 0}</div><div class="hud-stat-label">Births</div></div>
        <div class="hud-stat"><div class="hud-stat-val">${myStats.deaths || 0}</div><div class="hud-stat-label">Deaths</div></div>
        <div class="hud-stat"><div class="hud-stat-val">${myStats.damage_dealt || 0}</div><div class="hud-stat-label">Dmg Dealt</div></div>
        <div class="hud-stat"><div class="hud-stat-val">${myStats.damage_taken || 0}</div><div class="hud-stat-label">Dmg Taken</div></div>
      `;
    }
  }

  _formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  _esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  dispose() {
    this.el.remove();
  }
}
