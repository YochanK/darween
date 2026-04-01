const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page1 = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page1.goto('http://localhost:5173');
  await page1.waitForTimeout(1500);
  await page1.fill('#username-input', 'Alice');
  await page1.click('#create-btn');
  await page1.waitForTimeout(1000);

  const roomCode = await page1.textContent('#room-code-display');

  const page2 = await browser.newPage();
  await page2.goto('http://localhost:5173');
  await page2.waitForTimeout(1500);
  await page2.fill('#username-input', 'Bob');
  await page2.fill('#room-code-input', roomCode);
  await page2.click('#join-btn');
  await page2.waitForTimeout(1000);

  await page1.click('#start-btn');
  await page1.waitForTimeout(800);

  // Quick selections
  await page1.click('.archetype-card[data-id="bunny"]');
  await page1.click('.gene-card[data-id="sugar_rush"]');
  await page1.click('#confirm-btn');
  await page1.waitForTimeout(300);

  await page2.click('.archetype-card[data-id="lion"]');
  await page2.click('.gene-card[data-id="predator_instinct"]');
  await page2.click('#confirm-btn');
  await page2.waitForTimeout(800);

  await page1.click('#launch-btn');

  // Wait for game to run for a bit
  await page1.waitForTimeout(8000);
  await page1.screenshot({ path: '/tmp/darween_hud_full.png', fullPage: false });

  console.log('Done!');
  await browser.close();
})();
