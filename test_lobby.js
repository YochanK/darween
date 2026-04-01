const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();

  // Player 1: Create room
  const page1 = await browser.newPage();
  await page1.goto('http://localhost:5173');
  await page1.waitForTimeout(1500);

  // Enter username and create room
  await page1.fill('#username-input', 'Alice');
  await page1.click('#create-btn');
  await page1.waitForTimeout(1500);

  // Screenshot room screen
  await page1.screenshot({ path: '/tmp/darween_room.png' });

  // Get room code from the display
  const roomCode = await page1.textContent('#room-code-display');
  console.log('Room code:', roomCode);

  // Player 2: Join room
  const page2 = await browser.newPage();
  await page2.goto('http://localhost:5173');
  await page2.waitForTimeout(1500);

  await page2.fill('#username-input', 'Bob');
  await page2.fill('#room-code-input', roomCode);
  await page2.click('#join-btn');
  await page2.waitForTimeout(1500);

  // Screenshot both
  await page2.screenshot({ path: '/tmp/darween_room_p2.png' });
  await page1.screenshot({ path: '/tmp/darween_room_p1_updated.png' });

  console.log('Test completed successfully!');
  await browser.close();
})();
