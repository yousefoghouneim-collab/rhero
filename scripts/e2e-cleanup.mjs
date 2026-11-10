// Removes the test cleaner created by scripts/e2e.mjs (demo workspace) and rebuilds the demo.
// Usage: SHOTS=./shots node scripts/e2e-cleanup.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');
const URL = 'https://yxmyavagjafymwnejaqp.supabase.co';
const KEY = fs.readFileSync(new globalThis.URL('../src/lib/supabase.ts', import.meta.url), 'utf8').match(/'(eyJ[^']+)'/)[1];
const SHOTS = process.env.SHOTS || './shots';
const sb = createClient(URL, KEY, { auth: { persistSession: false } });
const { error } = await sb.auth.signInWithPassword({ email: 'dina@demo.rhero.app', password: 'RHero-demo-2026' });
if (error) throw error;
const { data: s } = await sb.auth.getSession();
const call = async (action, payload) => {
  const res = await fetch(`${URL}/functions/v1/rh-admin`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: `Bearer ${s.session.access_token}` }, body: JSON.stringify({ action, ...payload }) });
  return [res.status, await res.json()];
};
const { data: extra } = await sb.from('rh_profiles').select('id, full_name, phone').like('full_name', 'E2E %');
for (const p of extra ?? []) console.log('remove', p.full_name, p.phone, ...(await call('members.delete', { id: p.id })));
const f = path.join(SHOTS, 'cleanup.json');
if (fs.existsSync(f)) fs.unlinkSync(f);
const { data, error: re } = await sb.rpc('rh_demo_refresh', { p_force: true });
console.log('demo rebuilt', data, re?.message ?? '');
