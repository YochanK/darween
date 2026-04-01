/**
 * Procedural pixel-art map background — rendered once, persists across all UI screens.
 * Hidden automatically when the Three.js game canvas is active.
 */
export function createMapBackground(appEl) {
  const W = 320, H = 180;
  const canvas = document.createElement('canvas');
  canvas.id = 'bg-map';
  canvas.width = W;
  canvas.height = H;
  canvas.style.cssText = `
    position: absolute;
    top: -5%; left: -5%; width: 110%; height: 110%;
    image-rendering: pixelated;
    filter: blur(3px) brightness(0.45) saturate(1.1);
    pointer-events: none;
    animation: bgDrift 40s ease-in-out infinite;
  `;

  // Inject keyframe animation into document once
  if (!document.getElementById('bg-map-style')) {
    const style = document.createElement('style');
    style.id = 'bg-map-style';
    style.textContent = `
      @keyframes bgDrift {
        0%, 100% { transform: translate(0, 0); }
        25%       { transform: translate(-1.5%, -1%); }
        75%       { transform: translate(1%, 0.8%); }
      }
    `;
    document.head.appendChild(style);
  }

  _drawMap(canvas, W, H);

  // Insert as first child so Three.js canvas renders on top during gameplay
  appEl.insertBefore(canvas, appEl.firstChild);
  return canvas;
}

function _drawMap(canvas, W, H) {
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);

  const px = Math.random() * Math.PI * 2;
  const py = Math.random() * Math.PI * 2;

  const DEEP_WATER  = [12,  42,  80];
  const WATER       = [22,  80, 140];
  const SHALLOW     = [38, 110, 160];
  const SAND        = [175, 152, 90];
  const GRASS_LIGHT = [72, 128,  55];
  const GRASS       = [55, 105,  42];
  const FOREST      = [38,  80,  30];
  const DENSE       = [25,  58,  22];
  const STONE       = [100,  92,  82];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = x / W, ny = y / H;
      let h = 0;
      h += Math.sin(nx * 8.4  + px)       * Math.cos(ny * 7.2  + py)       * 0.40;
      h += Math.sin(nx * 17.1 + py * 1.3) * Math.cos(ny * 15.3 + px * 0.7) * 0.28;
      h += Math.sin(nx * 33.7 + px * 2.1) * Math.cos(ny * 29.8 + py * 1.9) * 0.18;
      h += Math.sin(nx * 67.0 + py * 3.0) * Math.cos(ny * 61.0 + px * 2.5) * 0.09;
      h += Math.sin(nx * 130  + px * 4.2) * Math.cos(ny * 118  + py * 3.8) * 0.05;
      h = (h + 1) * 0.5;

      let col;
      if      (h < 0.30) col = DEEP_WATER;
      else if (h < 0.40) col = WATER;
      else if (h < 0.46) col = SHALLOW;
      else if (h < 0.50) col = SAND;
      else if (h < 0.58) col = GRASS_LIGHT;
      else if (h < 0.70) col = GRASS;
      else if (h < 0.82) col = FOREST;
      else if (h < 0.90) col = DENSE;
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
