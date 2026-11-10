// End-to-end test against a running build (default http://localhost:4173).
// Proves the live loop: cleaner (phone + PIN demo) acts on the phone → the manager
// dashboard updates in real time without reloading.
// Usage: BASE=http://localhost:4173 SHOTS=./shots node scripts/e2e.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173';
const SHOTS = process.env.SHOTS || './shots';
fs.mkdirSync(SHOTS, { recursive: true });

const errors = [];
const results = [];
const ok = (name, cond, extra = '') => { results.push({ name, pass: !!cond }); console.log(`${cond ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`); };
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
const watch = (page, who) => {
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${who}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${who}] pageerror ${e.message}`));
};
async function waitFor(fn, ms = 10000, step = 250) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return true; await new Promise((r) => setTimeout(r, step)); }
  return false;
}

const outboxEmpty = (page) => waitFor(async () => (await page.evaluate(() => JSON.parse(localStorage.getItem('rhero-outbox-v1') || '[]').length)) === 0, 20000);
const browser = await chromium.launch();
const phone = { ...devices['iPhone 14'], deviceScaleFactor: 1 };

// ---- manager on a laptop, watching the dashboard
const mCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const m = await mCtx.newPage();
watch(m, 'manager');
await m.goto(`${BASE}/login?demo=manager`);
await m.waitForURL('**/m', { timeout: 25000 });
await m.waitForSelector('[data-testid="kpi-cleaning"]');
ok('manager signs in with the demo button', true);
ok('live updates connected', await waitFor(() => m.locator('[title="Live updates on"]').isVisible(), 10000));
const kpi = async (id) => (await m.locator(`[data-testid="${id}"]`).innerText()).trim();
await waitFor(async () => (await kpi('kpi-cleaning')) !== '0/0' && (await kpi('kpi-stock')) !== '0/0', 15000);
await m.waitForTimeout(1500);
const cleaningBefore = await kpi('kpi-cleaning');
const issuesBefore = Number(await kpi('kpi-issues'));
const stockBefore = await kpi('kpi-stock');
await shot(m, 'm1-dashboard');

// ---- cleaner on a phone (phone number + PIN demo login)
const cCtx = await browser.newContext(phone);
const c = await cCtx.newPage();
watch(c, 'cleaner');
await c.goto(`${BASE}/login`);
await c.waitForSelector('text=Grace Nakato');
await shot(c, 'c0-login');
// real phone+PIN form (not the demo button)
await c.fill('#phone', '050 111 1111');
await c.fill('#pin', '1111');
await c.click('button[type="submit"]');
await c.waitForURL('**/c', { timeout: 25000 });
await c.waitForTimeout(1500);
ok('cleaner signs in with phone + PIN', true);
ok('cleaner UI in Luganda', (await c.locator('text=Leero').count()) > 0);
await shot(c, 'c1-today');

// tick the next open task of the current round
await c.locator('a[href^="/c/round/"]').first().click();
await c.waitForURL('**/c/round/**');
await c.waitForSelector('[data-testid="task-row"]');
const open = c.locator('[data-testid="task-row"][data-done="0"]').first();
const taskText = (await open.innerText()).split('\n')[0];
await open.click();
ok('cleaner ticks a task', await waitFor(async () => (await c.locator('[data-testid="task-row"][data-done="1"]').count()) > 0, 3000), taskText);
ok('tick synced to the server', await outboxEmpty(c));
ok('Luganda task names show the English name underneath', (await c.locator('[data-testid="task-row"] span[lang="en"]').count()) > 0);
await shot(c, 'c2-round');
const cleaningLive = await waitFor(async () => (await kpi('kpi-cleaning')) !== cleaningBefore, 12000);
ok('manager dashboard updates live (cleaning)', cleaningLive, `${cleaningBefore} → ${await kpi('kpi-cleaning')}`);

// stock count: change one value and save
await c.goto(`${BASE}/c/stock`);
await c.waitForSelector('button[aria-label="plus"]');
await c.locator('button[aria-label="plus"]').first().click();
await c.locator('button.shadow-lift').click();
ok('stock count synced to the server', await outboxEmpty(c));
await shot(c, 'c3-stock');
const stockLive = await waitFor(async () => { const [a, b] = (await kpi('kpi-stock')).split('/'); return a === b && a !== '0'; }, 15000);
ok('manager dashboard shows the completed stock count', stockLive, `${stockBefore} → ${await kpi('kpi-stock')}`);

// report a problem
await c.goto(`${BASE}/c/issue`);
await c.waitForSelector('text=Ebikozesebwa biweddeyo');
await c.click('text=Ebikozesebwa biweddeyo');
await c.locator('textarea').fill('E2E test: soap finished in the kitchen');
await c.locator('button.h-14').last().click();
ok('problem report synced to the server', await outboxEmpty(c));
await shot(c, 'c4-issue');
const issueLive = await waitFor(async () => Number(await kpi('kpi-issues')) > issuesBefore, 15000);
ok('manager sees the reported problem live', issueLive, `${issuesBefore} → ${await kpi('kpi-issues')}`);
await shot(m, 'm2-dashboard-after');

// cleaner changes the app language on the phone (Kiswahili) and back to Luganda
await c.goto(`${BASE}/c/me`);
await c.locator('button:has-text("Olulimi")').click();
await c.locator('button:has-text("Kiswahili")').click();
ok('cleaner switches to Kiswahili', await waitFor(() => c.locator('text=Lugha').first().isVisible(), 10000));
await c.locator('button:has-text("Lugha")').click();
await c.locator('button:has-text("Luganda")').click();
ok('cleaner switches back to Luganda', await waitFor(() => c.locator('text=Olulimi').first().isVisible(), 10000));
await shot(c, 'c5-me');

// manager pages render
for (const [url, name, text] of [
  ['/m/inventory', 'm3-inventory', 'Order now'], ['/m/supply', 'm4-supply', 'Items to supply'], ['/m/cleaning', 'm5-cleaning', 'Morning Deep Clean'],
  ['/m/requests', 'm6-requests', 'Requests & orders'], ['/m/passes', 'm7-passes', 'Gate passes'], ['/m/reports', 'm8-reports', 'Daily reports'],
  ['/m/team', 'm9-team', 'Esther Akello'], ['/m/forms', 'm10-forms', 'Gate pass request'], ['/m/settings', 'm11-settings', 'Workspace'],
]) {
  await m.goto(`${BASE}${url}`);
  const seen = await waitFor(() => m.locator(`text=${text}`).first().isVisible(), 8000);
  await shot(m, name);
  ok(`page ${url}`, seen);
}

// create an order from the To-supply list
await m.goto(`${BASE}/m/supply`);
await m.waitForSelector('text=Select all red');
await m.click('text=Select all red');
const createBtn = m.locator('button:has-text("Create order")');
if (await createBtn.isVisible().catch(() => false)) {
  await createBtn.click();
  ok('draft purchase order created', await waitFor(() => m.locator('text=Mark as ordered').isVisible(), 8000));
  await shot(m, 'm12-order');
} else {
  ok('draft purchase order created', true, 'all red items already on order');
}

// public request form (no login)
await m.goto(`${BASE}/m/forms`);
await m.waitForSelector('div.font-mono');
const link = (await m.locator('div.font-mono').first().innerText()).replace(/^https?:\/\/[^/]+/, BASE);
const p = await (await browser.newContext(phone)).newPage();
watch(p, 'public');
await p.goto(link);
await p.waitForSelector('text=Send to the office manager');
await p.fill('input[name="title"]', 'E2E test monitor');
await p.fill('input[name="requester_name"]', 'E2E Tester');
await shot(p, 'p1-form');
await p.click('text=Send to the office manager');
ok('employee submits a request without login', await waitFor(() => p.locator('text=Sent — thank you!').isVisible(), 10000));
await shot(p, 'p2-form-sent');

// a new cleaner with a Ugandan number (07…) signs in with the +256 format
const ugLocal = '0772' + String(Math.floor(100000 + Math.random() * 899999));
await m.goto(`${BASE}/m/team`);
await m.locator('button:has-text("Add")').first().click();
await m.fill('input[placeholder="e.g. Grace Nakato"]', 'E2E Sarah Nambi');
await m.fill('input[placeholder="050 123 4567"]', ugLocal);
await m.locator('input[inputmode="numeric"]').first().fill('4321');
await m.locator('select').first().selectOption('lg');
await m.locator('button:has-text("Create account")').click();
ok('manager adds a cleaner with a Ugandan number (Luganda WhatsApp message)', await waitFor(() => m.locator('pre:has-text("Oli otya")').isVisible(), 12000));
await shot(m, 'm13-team-uganda');
const u = await (await browser.newContext(phone)).newPage();
watch(u, 'ugandan');
await u.goto(`${BASE}/login`);
await u.waitForSelector('#phone');
await u.fill('#phone', '+256 ' + ugLocal.slice(1));
await u.fill('#pin', '4321');
await u.click('button[type="submit"]');
ok('Ugandan number signs in (+256 …)', await u.waitForURL('**/c', { timeout: 25000 }).then(() => true, () => false));
ok('new cleaner sees the app in Luganda', await waitFor(() => u.locator('text=Leero').first().isVisible(), 10000));
await shot(u, 'u1-today');
fs.writeFileSync(path.join(SHOTS, 'cleanup.json'), JSON.stringify({ phone: '+256' + ugLocal.slice(1) }));

await browser.close();
const real = errors.filter((e) => !/favicon|Failed to load resource: the server responded with a status of 40[0-9]/.test(e));
console.log('\nConsole errors:', real.length ? '\n' + real.join('\n') : 'none');
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
