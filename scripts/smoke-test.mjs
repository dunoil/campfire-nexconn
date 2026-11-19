import { chromium } from 'playwright-core';

const EXE = process.env.CHROME_EXE ?? '';
const URL = 'http://localhost:4173/';
const results = [];
const check = (name, ok, extra = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`); };

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const errors = [];
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(URL, { waitUntil: 'networkidle' });
check('gate renders with brand', await page.locator('.brand-big').isVisible());
check('demo mode banner shown', (await page.locator('.mode-banner').innerText()).includes('Demo mode'));
check('4 persona cards', (await page.locator('.persona-card').count()) === 4);
await page.screenshot({ path: '/tmp/smoke/1-gate.png' });

// Enter as Ava
await page.click('[data-persona="ava"]');
await page.waitForSelector('.shell', { timeout: 5000 });
check('shell renders after persona pick', true);
await page.waitForSelector('.chan', { timeout: 5000 });
check('channel list has 7 entries (4 rooms + 3 DMs)', (await page.locator('.chan').count()) === 7, String(await page.locator('.chan').count()));
await page.waitForSelector('.msg', { timeout: 5000 });
const msgCount = await page.locator('.msg').count();
check('seeded messages render in Campfire General', msgCount >= 5, `${msgCount} messages`);
check('seeded poll card renders', await page.locator('.poll-card').isVisible());
const pollText = await page.locator('.poll-card').innerText();
check('seeded poll shows vote tallies', /votes/.test(pollText), pollText.split('\n').slice(-1)[0]);

// Vote on the seeded poll (option 3: Cooking swap)
const before = await page.locator('.poll-card').innerText();
await page.locator('.poll-opt').nth(2).click();
await page.waitForTimeout(400);
const after = await page.locator('.poll-card').innerText();
check('voting updates tally', before !== after);

// Send a text message
await page.fill('#composer-input', 'Hello from the smoke test! 🔥');
await page.keyboard.press('Enter');
await page.waitForTimeout(500);
const streamText = await page.locator('#stream').innerText();
check('sent message appears in stream', streamText.includes('Hello from the smoke test!'));

// Create a poll
await page.click('#poll-btn');
await page.fill('#poll-q', 'Best day for the riverside walk?');
const opts = page.locator('.poll-opt-input');
await opts.nth(0).fill('Saturday');
await opts.nth(1).fill('Sunday');
await page.click('#poll-create');
await page.waitForTimeout(600);
const stream2 = await page.locator('#stream').innerText();
check('created poll appears in stream', stream2.includes('Best day for the riverside walk?'));
await page.screenshot({ path: '/tmp/smoke/2-chat.png' });

// Reaction: hover first message, click heart in its action bar
const firstMsg = page.locator('.msg').first();
await firstMsg.hover();
await firstMsg.locator('.msg-actions button').nth(1).click();
await page.waitForTimeout(500);
check('reaction chip appears', (await page.locator('.chip').count()) >= 1);

// Bot reply may arrive (65% chance) — wait and see, non-fatal
await page.waitForTimeout(4500);
const stream3 = await page.locator('#stream').innerText();
results.push(`INFO  bot/neighbour activity after send: ${stream3.includes('Welcome to the circle') || stream3.split('\n').length > 10 ? 'activity present' : 'quiet this run (randomised)'}`);

// Second tab as Ben — cross-tab real-time via BroadcastChannel
const page2 = await ctx.newPage();
const errors2 = [];
page2.on('pageerror', (e) => errors2.push(e.message));
await page2.goto(URL, { waitUntil: 'networkidle' });
await page2.click('[data-persona="ben"]');
await page2.waitForSelector('.shell');
await page2.waitForSelector('.msg');
await page2.fill('#composer-input', 'Ben here — cross-tab message!');
await page2.keyboard.press('Enter');
await page.waitForTimeout(1200);
const avaStream = await page.locator('#stream').innerText();
check('cross-tab message from Ben reaches Ava live', avaStream.includes('Ben here — cross-tab message!'));
await page.screenshot({ path: '/tmp/smoke/3-crosstab.png' });

// DM flow on page2: open DM with Ava, send
await page2.locator('.chan[data-kind="direct"][data-id="ava"]').click();
await page2.waitForTimeout(600);
await page2.fill('#composer-input', 'DM from Ben to Ava');
await page2.keyboard.press('Enter');
await page.waitForTimeout(800);
check('DM send works', (await page2.locator('#stream').innerText()).includes('DM from Ben to Ava'));

// Switch room on page1
await page.locator('.chan[data-kind="group"][data-id="help-circle"]').click();
await page.waitForTimeout(600);
check('room switching works (Help Circle content)', (await page.locator('#stream').innerText()).includes('ladder'));

check('no page errors on page 1', errors.length === 0, errors.join(' | '));
check('no page errors on page 2', errors2.length === 0, errors2.join(' | '));

console.log(results.join('\n'));
await browser.close();
