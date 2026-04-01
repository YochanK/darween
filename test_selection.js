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

  // Get room code
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

  // Host clicks Start -> go to selection screen
  await page1.click('#start-btn');
  await page1.waitForTimeout(1000);

  // Screenshot selection screen
  await page1.screenshot({ path: '/tmp/darween_selection_p1.png' });
  await page2.screenshot({ path: '/tmp/darween_selection_p2.png' });

  // Player 1: select Fox + Sugar Rush, confirm
  await page1.click('.archetype-card[data-id="fox"]');
  await page1.waitForTimeout(300);
  await page1.click('.gene-card[data-id="sugar_rush"]');
  await page1.waitForTimeout(300);
  await page1.click('#confirm-btn');
  await page1.waitForTimeout(500);

  // Player 2: select Elephant + Aquatic, confirm
  await page2.click('.archetype-card[data-id="elephant"]');
  await page2.waitForTimeout(300);
  await page2.click('.gene-card[data-id="aquatic_adaptation"]');
  await page2.waitForTimeout(300);
  await page2.click('#confirm-btn');
  await page2.waitForTimeout(1000);

  // Screenshot after both confirmed
  await page1.screenshot({ path: '/tmp/darween_selection_confirmed.png' });

  // Host launches game
  const launchBtn = page1.locator('#launch-btn');
  if (await launchBtn.isVisible()) {
    await launchBtn.click();
    await page1.waitForTimeout(2000);
    await page1.screenshot({ path: '/tmp/darween_game_start.png' });
    await page2.screenshot({ path: '/tmp/darween_game_start_p2.png' });
    console.log('Game started!');
  } else {
    console.log('Launch button not visible yet');
    await page1.screenshot({ path: '/tmp/darween_selection_debug.png' });
  }

  await browser.close();
})();
