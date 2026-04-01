const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();

  // Player 1: Create room
  const page1 = await browser.newPage();
  await page1.goto('http://localhost:5173');
  await page1.waitForTimeout(1500);
  await page1.fill('#username-input', 'Alice');
  await page1.click('#create-btn');
  await page1.waitForTimeout(1000);

  const roomCode = await page1.textContent('#room-code-display');
  console.log('Room code:', roomCode);

  // Player 2: Join room
  const page2 = await browser.newPage();
  await page2.goto('http://localhost:5173');
  await page2.waitForTimeout(1500);
  await page2.fill('#username-input', 'Bob');
  await page2.fill('#room-code-input', roomCode);
  await page2.click('#join-btn');
  await page2.waitForTimeout(1000);

  // Host starts -> selection screen
  await page1.click('#start-btn');
  await page1.waitForTimeout(1000);

  // Both select and confirm
  await page1.click('.archetype-card[data-id="fox"]');
  await page1.click('.gene-card[data-id="sugar_rush"]');
  await page1.click('#confirm-btn');
  await page1.waitForTimeout(500);

  await page2.click('.archetype-card[data-id="elephant"]');
  await page2.click('.gene-card[data-id="aquatic_adaptation"]');
  await page2.click('#confirm-btn');
  await page2.waitForTimeout(1000);

  // Host launches game
  await page1.click('#launch-btn');
  console.log('Game launching...');

  // Wait for creatures to load and game to run
  await page1.waitForTimeout(5000);

  // Capture console errors
  page1.on('console', msg => {
    if (msg.type() === 'error') console.log('P1 error:', msg.text());
  });

  // Screenshot after game has been running
  await page1.screenshot({ path: '/tmp/darween_creatures.png' });
  await page2.screenshot({ path: '/tmp/darween_creatures_p2.png' });

  // Pixel-sample the screenshot to verify team colors are visible
  // (WebGL readPixels won't work without preserveDrawingBuffer; use screenshot buffer instead)
  const { createCanvas, loadImage } = (() => {
    try { return require('canvas'); } catch { return {}; }
  })();

  const screenshotBuffer = await page1.screenshot({ path: '/tmp/darween_creatures.png' });

  // Analyze colors using Playwright's evaluate on an offscreen canvas
  const colorStats = await page1.evaluate(async (imgBase64) => {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = 'data:image/png;base64,' + imgBase64;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const samples = [];
    const step = Math.floor(img.width / 10);
    for (let sy = 1; sy < 10; sy++) {
      for (let sx = 1; sx < 10; sx++) {
        const x = sx * step;
        const y = sy * Math.floor(img.height / 10);
        const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
        samples.push({ r, g, b });
      }
    }

    const colored = samples.filter(p => {
      const max = Math.max(p.r, p.g, p.b);
      const min = Math.min(p.r, p.g, p.b);
      const saturation = max > 0 ? (max - min) / max : 0;
      const isWhite = p.r > 240 && p.g > 240 && p.b > 240;
      return saturation > 0.15 && !isWhite;
    });
    return { total: samples.length, colored: colored.length };
  }, screenshotBuffer.toString('base64'));

  console.log(`Color check: ${colorStats.colored}/${colorStats.total} sampled pixels show saturation`);
  if (colorStats.colored < 5) {
    console.error('FAIL: Not enough color variety — creatures may appear washed out');
  } else {
    console.log('PASS: Scene has good color variety');
  }

  console.log('Screenshots taken.');

  await browser.close();
})();
