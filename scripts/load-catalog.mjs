// Re-loads supabase/seed/catalog.json into rh_catalog (used for new workspaces and the demo).
// Needs the one-time bootstrap secret (rh_config.bootstrap_secret) — only available during setup.
// Usage: RH_SECRET=... node scripts/load-catalog.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FN = 'https://yxmyavagjafymwnejaqp.supabase.co/functions/v1/rh-admin';
const ANON = 'sb_publishable_n3qfTGqJ9hX4_TaBd9IT-A_pTqgGByi';
const SECRET = process.env.RH_SECRET;
if (!SECRET) throw new Error('RH_SECRET missing');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'supabase/seed/catalog.json'), 'utf8'));
delete catalog._about;
const res = await fetch(FN, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', apikey: ANON, 'x-rh-secret': SECRET },
  body: JSON.stringify({ action: 'bootstrap.load_catalog', catalog }),
});
console.log(res.status, await res.text());
if (!res.ok) process.exit(1);
