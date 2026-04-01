const TEAM_COLORS = [
  '#ff4444','#4488ff','#44dd66','#ffcc44','#ff88cc',
  '#88ffff','#ff8844','#aa88ff','#88ff88','#ffff44',
  '#ff4488','#44ffcc','#ff6644','#4444ff','#ccff44',
  '#ff44ff','#44ccff','#88ff44','#ff8888','#44ff88',
];

const SAMPLE_INTERVAL = 5;  // record every N ticks
const MAX_SAMPLES     = 300;

/**
 * Collapsible right-side panel with live Canvas 2D charts.
 */
export class StatsPanel {
  constructor(container) {
    this._history   = [];
    this._lastTick  = -Infinity;
    this._visible   = false;
    this._teamOrder = []; // stable ordering of team ids

    // ── DOM ──────────────────────────────────────────────────────────
    this._panel = document.createElement('div');
    this._panel.id = 'stats-panel';
    this._panel.innerHTML = `
      <style>
        #stats-panel {
          position: absolute;
          top: 0; right: 0; bottom: 0;
          width: 280px;
          background: rgba(8, 10, 14, 0.82);
          border-left: 1px solid rgba(255,255,255,0.08);
          padding: 14px 12px 14px 14px;
          display: none;
          overflow-y: auto;
          font-family: 'Segoe UI', system-ui, sans-serif;
          color: #ccc;
          pointer-events: auto;
          z-index: 10;
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
        }
        #stats-panel::-webkit-scrollbar { width: 4px; }
        #stats-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }

        .sp-title {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          color: #fff;
          margin-bottom: 14px;
        }
        .sp-chart-box {
          margin-bottom: 16px;
        }
        .sp-chart-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: #777;
          margin-bottom: 4px;
        }
        .sp-chart-canvas {
          width: 100%;
          border-radius: 6px;
          background: rgba(255,255,255,0.03);
        }
        .sp-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 6px 10px;
          margin-top: 6px;
        }
        .sp-legend-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          color: #aaa;
        }
        .sp-legend-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .sp-summary {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          margin-bottom: 14px;
        }
        .sp-stat-card {
          background: rgba(255,255,255,0.04);
          border-radius: 8px;
          padding: 8px 10px;
        }
        .sp-stat-val {
          font-size: 18px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          color: #fff;
        }
        .sp-stat-lbl {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          color: #666;
          margin-top: 2px;
        }
      </style>

      <div class="sp-title">Live Statistics</div>

      <div class="sp-summary" id="sp-summary"></div>

      <div class="sp-chart-box">
        <div class="sp-chart-label">Population</div>
        <canvas class="sp-chart-canvas" id="sp-pop-chart" height="120"></canvas>
        <div class="sp-legend" id="sp-pop-legend"></div>
      </div>

      <div class="sp-chart-box">
        <div class="sp-chart-label">Food on Map</div>
        <canvas class="sp-chart-canvas" id="sp-food-chart" height="100"></canvas>
      </div>

      <div class="sp-chart-box">
        <div class="sp-chart-label">Damage Dealt</div>
        <canvas class="sp-chart-canvas" id="sp-dmg-chart" height="120"></canvas>
      </div>
    `;
    container.appendChild(this._panel);

    this._popCanvas  = this._panel.querySelector('#sp-pop-chart');
    this._foodCanvas = this._panel.querySelector('#sp-food-chart');
    this._dmgCanvas  = this._panel.querySelector('#sp-dmg-chart');
    this._popLegend  = this._panel.querySelector('#sp-pop-legend');
    this._summary    = this._panel.querySelector('#sp-summary');
  }

  /** Toggle panel visibility. */
  toggle() {
    this._visible = !this._visible;
    this._panel.style.display = this._visible ? 'block' : 'none';
    if (this._visible) this._redraw();
    return this._visible;
  }

  get visible() { return this._visible; }

  /**
   * Feed a STATE_UPDATE snapshot. Sampled every SAMPLE_INTERVAL ticks.
   */
  push(data, teamsData) {
    const tick = data.tick ?? 0;
    if (tick - this._lastTick < SAMPLE_INTERVAL) return;
    this._lastTick = tick;

    const snap = {
      tick,
      phase: data.phase,
      turn: data.turn_number ?? 1,
      appleCount: data.apples?.length ?? 0,
      teams: {},
    };

    for (const [tid, stats] of Object.entries(data.team_stats ?? {})) {
      snap.teams[tid] = {
        pop:    stats.population   ?? 0,
        births: stats.births       ?? 0,
        deaths: stats.deaths       ?? 0,
        dmgD:   stats.damage_dealt ?? 0,
        dmgT:   stats.damage_taken ?? 0,
        ci:     teamsData[tid]?.color_index ?? 0,
        name:   teamsData[tid]?.username    ?? '?',
      };
    }

    // Establish stable team ordering from first snapshot
    if (this._teamOrder.length === 0) {
      this._teamOrder = Object.keys(snap.teams);
    }

    this._history.push(snap);
    if (this._history.length > MAX_SAMPLES) this._history.shift();

    if (this._visible) this._redraw();
  }

  // ── Drawing ────────────────────────────────────────────────────────

  _redraw() {
    if (this._history.length < 2) return;
    this._drawSummary();
    this._drawPopulation();
    this._drawFood();
    this._drawDamage();
  }

  _drawSummary() {
    const last = this._history[this._history.length - 1];
    let totalPop = 0, totalBirths = 0, totalDeaths = 0, totalDmg = 0;
    for (const t of Object.values(last.teams)) {
      totalPop    += t.pop;
      totalBirths += t.births;
      totalDeaths += t.deaths;
      totalDmg    += t.dmgD;
    }
    this._summary.innerHTML = `
      <div class="sp-stat-card"><div class="sp-stat-val">${totalPop}</div><div class="sp-stat-lbl">Total Pop</div></div>
      <div class="sp-stat-card"><div class="sp-stat-val">${last.appleCount}</div><div class="sp-stat-lbl">Apples</div></div>
      <div class="sp-stat-card"><div class="sp-stat-val">${totalBirths}</div><div class="sp-stat-lbl">Births</div></div>
      <div class="sp-stat-card"><div class="sp-stat-val">${totalDeaths}</div><div class="sp-stat-lbl">Deaths</div></div>
    `;
  }

  _drawPopulation() {
    const series = this._teamOrder.map(tid => ({
      color: TEAM_COLORS[(this._history[0].teams[tid]?.ci ?? 0) % TEAM_COLORS.length],
      label: this._history[0].teams[tid]?.name ?? '?',
      data:  this._history.map(s => s.teams[tid]?.pop ?? 0),
    }));
    this._drawLineChart(this._popCanvas, series);

    // Legend
    this._popLegend.innerHTML = series.map(s =>
      `<span class="sp-legend-item"><span class="sp-legend-dot" style="background:${s.color}"></span>${this._esc(s.label)}</span>`
    ).join('');
  }

  _drawFood() {
    const data = this._history.map(s => s.appleCount);
    this._drawLineChart(this._foodCanvas, [{
      color: '#66dd55',
      data,
    }], { fill: true, fillColor: 'rgba(102,221,85,0.15)' });
  }

  _drawDamage() {
    const series = this._teamOrder.map(tid => ({
      color: TEAM_COLORS[(this._history[0].teams[tid]?.ci ?? 0) % TEAM_COLORS.length],
      data:  this._history.map(s => s.teams[tid]?.dmgD ?? 0),
    }));
    this._drawLineChart(this._dmgCanvas, series);
  }

  // ── Generic line-chart renderer ────────────────────────────────────

  _drawLineChart(canvas, series, opts = {}) {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 252;
    const cssH = parseInt(canvas.getAttribute('height')) || 120;
    canvas.width  = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.height = cssH + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const pad = { top: 6, right: 6, bottom: 4, left: 32 };
    const w = cssW - pad.left - pad.right;
    const h = cssH - pad.top  - pad.bottom;

    // Clear
    ctx.clearRect(0, 0, cssW, cssH);

    // Max value
    let maxVal = 1;
    for (const s of series) {
      for (const v of s.data) maxVal = Math.max(maxVal, v);
    }
    maxVal = Math.ceil(maxVal * 1.12) || 1;

    // Grid lines + labels
    const gridN = 3;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= gridN; i++) {
      const val = Math.round(maxVal * i / gridN);
      const yy = pad.top + h * (1 - i / gridN);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, yy);
      ctx.lineTo(pad.left + w, yy);
      ctx.stroke();
      ctx.fillStyle = '#555';
      ctx.font = '9px system-ui';
      ctx.fillText(val, pad.left - 5, yy);
    }

    // Lines
    const n = series[0]?.data.length ?? 0;
    if (n < 2) return;

    for (const s of series) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = pad.left + (i / (n - 1)) * w;
        const y = pad.top  + h * (1 - s.data[i] / maxVal);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Optional fill
      if (opts.fill) {
        ctx.lineTo(pad.left + w, pad.top + h);
        ctx.lineTo(pad.left, pad.top + h);
        ctx.closePath();
        ctx.fillStyle = opts.fillColor || 'rgba(255,255,255,0.05)';
        ctx.fill();
      }
    }
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  dispose() {
    this._panel.remove();
    this._history = [];
  }
}
