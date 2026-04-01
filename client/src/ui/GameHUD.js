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
          font-family: 'Segoe UI', system-ui, sans-serif;
          color: #fff;
        }
        #game-hud > * { pointer-events: auto; }

        .hud-top-bar {
          position: absolute; top: 0; left: 0; right: 0;
          display: flex; justify-content: space-between; align-items: center;
          padding: 12px 20px;
          background: linear-gradient(to bottom, rgba(0,0,0,0.6), transparent);
        }

        .hud-phase {
          display: flex; align-items: center; gap: 10px;
        }
        .phase-icon {
          width: 32px; height: 32px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px;
          transition: background 0.5s;
        }
        .phase-icon.day { background: #ffcc44; }
        .phase-icon.night { background: #3344aa; }
        .phase-label { font-size: 14px; font-weight: 600; }
        .phase-timer { font-size: 24px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .turn-label { font-size: 12px; color: #aaa; }

        .speed-controls {
          display: flex; align-items: center; gap: 4px;
        }
        .speed-btn {
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 6px;
          color: #aaa;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          padding: 4px 8px;
          transition: background 0.15s, color 0.15s;
        }
        .speed-btn:hover { background: rgba(255,255,255,0.2); color: #fff; }
        .speed-btn.active {
          background: #ffcc44;
          border-color: #ffcc44;
          color: #111;
        }

        .stats-toggle-btn {
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 6px;
          color: #aaa;
          cursor: pointer;
          font-size: 14px;
          padding: 4px 10px;
          margin-left: 10px;
          transition: background 0.15s, color 0.15s;
        }
        .stats-toggle-btn:hover { background: rgba(255,255,255,0.2); color: #fff; }
        .stats-toggle-btn.active {
          background: #ffcc44;
          border-color: #ffcc44;
          color: #111;
        }

        .hud-my-team {
          text-align: right;
        }
        .my-pop { font-size: 28px; font-weight: 700; }
        .my-pop-label { font-size: 12px; color: #aaa; }
        .my-food-label { font-size: 12px; color: #aaa; }

        .hud-leaderboard {
          position: absolute; top: 60px; right: 16px;
          background: rgba(0,0,0,0.6); border-radius: 12px;
          padding: 12px 16px; min-width: 200px;
          max-height: 300px; overflow-y: auto;
        }
        .lb-title { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
        .lb-row {
          display: flex; align-items: center; gap: 8px;
          padding: 4px 0; font-size: 13px;
        }
        .lb-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .lb-name { flex: 1; }
        .lb-pop { font-weight: 600; font-variant-numeric: tabular-nums; }
        .lb-you { color: #ffcc44; }

        .hud-bottom-bar {
          position: absolute; bottom: 0; left: 0; right: 0;
          padding: 8px 20px;
          background: linear-gradient(to top, rgba(0,0,0,0.5), transparent);
          display: flex; justify-content: center; gap: 24px;
          font-size: 12px; color: #aaa;
        }
      </style>

      <div class="hud-top-bar">
        <div class="hud-phase">
          <div class="phase-icon day" id="hud-phase-icon">☀</div>
          <div>
            <div class="phase-label" id="hud-phase-label">DAY</div>
            <div class="turn-label" id="hud-turn">Turn 1</div>
          </div>
          <div class="phase-timer" id="hud-timer">2:00</div>
        </div>
        <div style="display:flex;align-items:center">
          <div class="speed-controls" id="hud-speed-controls">
            <button class="speed-btn active" data-speed="1">1×</button>
            <button class="speed-btn" data-speed="2">2×</button>
            <button class="speed-btn" data-speed="4">4×</button>
            <button class="speed-btn" data-speed="8">8×</button>
            <button class="speed-btn" data-speed="16">16×</button>
          </div>
          <button class="stats-toggle-btn" id="hud-stats-toggle" title="Toggle statistics panel">📊</button>
        </div>
        <div class="hud-my-team">
          <div class="my-pop" id="hud-my-pop">5</div>
          <div class="my-pop-label">Your Population</div>
        </div>
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
    /** Set by main.js — called when player toggles the stats panel. */
    this.onStatsToggle = null;

    this.statsToggle = this.el.querySelector('#hud-stats-toggle');
    this.statsToggle.addEventListener('click', () => {
      if (this.onStatsToggle) {
        const active = this.onStatsToggle();
        this.statsToggle.classList.toggle('active', active);
      }
    });

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
      this.phaseIcon.className = 'phase-icon day';
      this.phaseLabel.textContent = 'DAY';
      const remaining = Math.max(0, 120 - timeInPhase);
      this.timer.textContent = this._formatTime(remaining);
    } else {
      this.phaseIcon.textContent = '🌙';
      this.phaseIcon.className = 'phase-icon night';
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
        <span class="lb-name">${i + 1}. ${this._esc(e.name)}${e.isMe ? ' (you)' : ''}</span>
        <span class="lb-pop">${e.pop}</span>
      </div>
    `).join('');

    // Bottom bar stats
    if (myStats) {
      this.bottomBar.innerHTML = `
        <span>Births: ${myStats.births || 0}</span>
        <span>Deaths: ${myStats.deaths || 0}</span>
        <span>Dmg Dealt: ${myStats.damage_dealt || 0}</span>
        <span>Dmg Taken: ${myStats.damage_taken || 0}</span>
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
