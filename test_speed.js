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

  await page2.click('.archetype-card[data-id="lion"]');
  await page2.click('.gene-card[data-id="predator_instinct"]');
  await page2.click('#confirm-btn');
  await page2.waitForTimeout(1000);

  // Host launches game
  await page1.click('#launch-btn');
  console.log('Game launching...');
  await page1.waitForTimeout(4000);

  // ── Test 1: Default speed is 1× ──────────────────────────────────────────
  const activeBtn1x = await page1.$('.speed-btn.active[data-speed="1"]');
  if (activeBtn1x) {
    console.log('PASS: Default speed is 1×');
  } else {
    console.error('FAIL: Default speed button is not 1×');
  }

  // ── Test 2: Click 8× on page1, verify both pages reflect it ──────────────
  await page1.click('.speed-btn[data-speed="8"]');
  await page1.waitForTimeout(1000); // wait for server round-trip

  const activeBtn8xP1 = await page1.$('.speed-btn.active[data-speed="8"]');
  const activeBtn8xP2 = await page2.$('.speed-btn.active[data-speed="8"]');

  if (activeBtn8xP1) {
    console.log('PASS: P1 HUD shows 8× active');
  } else {
    console.error('FAIL: P1 HUD does not show 8× active');
  }

  if (activeBtn8xP2) {
    console.log('PASS: P2 HUD synced to 8× (server broadcast worked)');
  } else {
    console.error('FAIL: P2 HUD did not sync to 8×');
  }

  // ── Test 3: At 8× speed, a full day (120s game time) should complete
  //   in ~15 real seconds. We wait 20s and check turn_number advanced. ───────
  console.log('Waiting 20s at 8× speed to confirm a day phase completes...');

  let latestTurn = 1;
  const checkTurn = async () => {
    try {
      const turnText = await page1.textContent('#hud-turn');
      const match = turnText?.match(/Turn\s+(\d+)/i);
      if (match) latestTurn = parseInt(match[1], 10);
    } catch {}
  };

  // Poll every 2 seconds for 20 seconds
  for (let i = 0; i < 10; i++) {
    await page1.waitForTimeout(2000);
    await checkTurn();
    console.log(`  t=${2*(i+1)}s → Turn ${latestTurn}`);
    if (latestTurn > 1) break;
  }

  if (latestTurn > 1) {
    console.log(`PASS: Turn advanced to ${latestTurn} — time acceleration confirmed`);
  } else {
    console.error('FAIL: Turn did not advance — time acceleration may not be working');
  }

  // ── Test 4: Set back to 1×, verify UI updates ────────────────────────────
  await page1.click('.speed-btn[data-speed="1"]');
  await page1.waitForTimeout(1000);

  const activeBtn1xAfter = await page1.$('.speed-btn.active[data-speed="1"]');
  if (activeBtn1xAfter) {
    console.log('PASS: Speed reset to 1×');
  } else {
    console.error('FAIL: Speed did not reset to 1×');
  }

  // Screenshots for visual check
  await page1.screenshot({ path: '/tmp/darween_speed_p1.png' });
  await page2.screenshot({ path: '/tmp/darween_speed_p2.png' });
  console.log('Screenshots saved to /tmp/darween_speed_p1.png and _p2.png');

  await browser.close();
})();
