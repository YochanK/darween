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

  // Check for console errors
  page1.on('console', msg => {
    if (msg.type() === 'error') console.log('P1 error:', msg.text());
  });

  // Screenshot after game has been running
  await page1.screenshot({ path: '/tmp/darween_creatures.png' });
  await page2.screenshot({ path: '/tmp/darween_creatures_p2.png' });

  // Check server logs for errors
  console.log('Screenshots taken. Checking server logs...');

  await browser.close();
})();
