// One-time setup: loads the default catalog and creates the demo + live workspaces.
// Usage: RH_SECRET=... RH_LIVE_PASSWORD=... node scripts/bootstrap.mjs
// (The secret lives in rh_config.bootstrap_secret and is removed after setup.)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FN = 'https://yxmyavagjafymwnejaqp.supabase.co/functions/v1/rh-admin';
const ANON = 'sb_publishable_n3qfTGqJ9hX4_TaBd9IT-A_pTqgGByi';
const SECRET = process.env.RH_SECRET;
if (!SECRET) throw new Error('RH_SECRET missing');

async function call(action, payload = {}) {
  const res = await fetch(FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON, 'x-rh-secret': SECRET },
    body: JSON.stringify({ action, ...payload }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${action} → ${res.status} ${body.error ?? ''}`);
  return body;
}

const catalog = JSON.parse(fs.readFileSync(path.join(root, 'supabase/seed/catalog.json'), 'utf8'));
delete catalog._about;
console.log('catalog', await call('bootstrap.load_catalog', { catalog }));

const demo = (await call('bootstrap.create_org', { name: 'RH Aero Systems · Demo', short_name: 'RH Aero', is_demo: true })).org;
console.log('demo org', demo.id);
const live = (await call('bootstrap.create_org', { name: 'RH Aero Systems — Dubai South', short_name: 'RH Aero', is_demo: false })).org;
console.log('live org', live.id);

const users = [
  { org_id: demo.id, full_name: 'Dina Maged', role: 'manager', email: 'dina@demo.rhero.app', password: 'RHero-demo-2026', language: 'en' },
  { org_id: demo.id, full_name: 'Grace Nakato', role: 'cleaner', phone: '050 111 1111', pin: '1111', language: 'lg' },
  { org_id: demo.id, full_name: 'Esther Akello', role: 'cleaner', phone: '050 222 2222', pin: '2222', language: 'sw' },
  { org_id: live.id, full_name: 'Dina Maged', role: 'manager', email: 'dina@rhero.app', password: process.env.RH_LIVE_PASSWORD, language: 'en' },
];
for (const u of users) {
  const r = await call('bootstrap.create_user', u);
  console.log('user', r.profile.full_name, r.profile.role, r.profile.org_id === demo.id ? 'demo' : 'live');
}
console.log('seed demo', await call('bootstrap.seed_demo', { org_id: demo.id }));
console.log(JSON.stringify({ demo_org: demo.id, live_org: live.id, demo_form_token: demo.form_token, live_form_token: live.form_token }));
