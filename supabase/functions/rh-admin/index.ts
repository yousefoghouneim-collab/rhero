// RHero admin function — team management (phone + PIN logins for cleaners),
// self-service account changes, and a secret-protected bootstrap.
// Deployed with verify_jwt = false: every action authenticates itself.
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-rh-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// ---- phone logins -------------------------------------------------------
// Keep in sync with src/lib/phone.ts
export function normalizePhone(raw: string): string | null {
  let s = String(raw ?? '').trim().replace(/[\s\-().]/g, '');
  if (!s) return null;
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (s.startsWith('+')) {
    const d = s.slice(1);
    return /^\d{8,15}$/.test(d) ? '+' + d : null;
  }
  if (!/^\d+$/.test(s)) return null;
  if (s.startsWith('971') && s.length >= 11) return '+' + s;          // 971 5X XXX XXXX
  if (s.startsWith('256') && s.length === 12) return '+' + s;         // 256 7XX XXX XXX (Uganda)
  if (s.startsWith('07') && s.length === 10) return '+256' + s.slice(1); // 07XX XXX XXX (Uganda)
  if (s.startsWith('0') && s.length === 10) return '+971' + s.slice(1);  // 05X XXX XXXX (UAE)
  if (s.length === 9 && s.startsWith('7')) return '+256' + s;         // 7XX XXX XXX (Uganda)
  if (s.length === 9 && /^[2-9]/.test(s)) return '+971' + s;          // 5X XXX XXXX (UAE)
  return null;
}
const PHONE_DOMAIN = 'phone.rhero.app';
const phoneEmail = (e164: string) => `${e164.slice(1)}@${PHONE_DOMAIN}`;
const pinPassword = (pin: string, e164: string) => `rh-${pin}-${e164.slice(1)}`;
const isPhoneLogin = (email?: string | null) => (email ?? '').endsWith('@' + PHONE_DOMAIN);
const COLORS = ['#202854', '#af1615', '#0f766e', '#7c3aed', '#c2410c', '#0369a1', '#be185d', '#4d7c0f'];
const LANGS = ['en', 'lg', 'sw', 'ar', 'hi', 'ur', 'bn', 'ml', 'tl'];

function validPin(pin: unknown): string {
  const p = String(pin ?? '').trim();
  if (!/^\d{4,8}$/.test(p)) throw new HttpError(400, 'PIN must be 4 to 8 digits');
  return p;
}
function validEmail(e: unknown): string {
  const s = String(e ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)) throw new HttpError(400, 'Email address looks wrong');
  return s;
}
function validPassword(p: unknown): string {
  const s = String(p ?? '');
  if (s.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
  return s;
}

type Profile = { id: string; org_id: string; role: 'manager' | 'cleaner'; active: boolean; phone: string | null; full_name: string };

async function getCaller(req: Request) {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Please sign in');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Your session expired — please sign in again');
  const { data: profile } = await admin.from('rh_profiles').select('*').eq('id', data.user.id).maybeSingle();
  if (!profile || !profile.active) throw new HttpError(403, 'Your account has no access');
  return { user: data.user, profile: profile as Profile };
}

async function phoneTaken(phone: string, exceptId?: string) {
  let q = admin.from('rh_profiles').select('id').eq('phone', phone);
  if (exceptId) q = q.neq('id', exceptId);
  const { data } = await q.limit(1);
  return (data ?? []).length > 0;
}

async function createMember(org_id: string, input: Record<string, unknown>) {
  const role = input.role === 'manager' ? 'manager' : 'cleaner';
  const full_name = String(input.full_name ?? '').trim();
  if (!full_name) throw new HttpError(400, 'Name is required');
  const language = LANGS.includes(String(input.language)) ? String(input.language) : 'en';

  let phone: string | null = null;
  if (input.phone) {
    phone = normalizePhone(String(input.phone));
    if (!phone) throw new HttpError(400, 'Phone number looks wrong — try e.g. 050 123 4567 or 0772 123 456');
    if (await phoneTaken(phone)) throw new HttpError(409, 'This phone number already has an account');
  }

  let email: string;
  let password: string;
  let contactEmail: string | null = null;
  const usePhoneLogin = role === 'cleaner' || !input.email;
  if (usePhoneLogin) {
    if (!phone) throw new HttpError(400, 'Phone number is required');
    const pin = validPin(input.pin);
    email = phoneEmail(phone);
    password = pinPassword(pin, phone);
    contactEmail = input.email ? validEmail(input.email) : null;
  } else {
    email = validEmail(input.email);
    password = validPassword(input.password);
    contactEmail = email;
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name, app: 'rhero' },
  });
  if (error || !created.user) {
    const msg = error?.message ?? 'Could not create the account';
    throw new HttpError(400, /already|registered|exists/i.test(msg) ? 'An account with this login already exists' : msg);
  }
  const { count } = await admin.from('rh_profiles').select('id', { count: 'exact', head: true }).eq('org_id', org_id);
  const { data: profile, error: pe } = await admin.from('rh_profiles').insert({
    id: created.user.id, org_id, full_name, role, phone, email: contactEmail, language,
    color: COLORS[(count ?? 0) % COLORS.length], active: true,
  }).select().single();
  if (pe) {
    await admin.auth.admin.deleteUser(created.user.id);
    throw new HttpError(400, pe.message);
  }
  return profile;
}

async function updateMember(caller: { user: { id: string }; profile: Profile }, input: Record<string, unknown>) {
  const targetId = String(input.id ?? caller.user.id);
  const isSelf = targetId === caller.user.id;
  const isManager = caller.profile.role === 'manager';
  if (!isSelf && !isManager) throw new HttpError(403, 'Only the office manager can change other accounts');

  const { data: target } = await admin.from('rh_profiles').select('*').eq('id', targetId).maybeSingle();
  if (!target || target.org_id !== caller.profile.org_id) throw new HttpError(404, 'Account not found');
  const { data: authData, error: ae } = await admin.auth.admin.getUserById(targetId);
  if (ae || !authData.user) throw new HttpError(404, 'Account not found');
  const loginByPhone = isPhoneLogin(authData.user.email);

  const patch: Record<string, unknown> = {};
  const authPatch: Record<string, unknown> = {};

  if (input.full_name !== undefined && (isManager || isSelf)) {
    const n = String(input.full_name).trim();
    if (n) patch.full_name = n;
  }
  if (input.language !== undefined && LANGS.includes(String(input.language))) patch.language = String(input.language);
  if (isManager && !isSelf && (input.role === 'manager' || input.role === 'cleaner')) patch.role = input.role;

  let phone: string | null = target.phone;
  const phoneChanging = input.phone !== undefined && String(input.phone ?? '') !== String(target.phone ?? '');
  if (phoneChanging) {
    if (!isManager) throw new HttpError(403, 'Ask the office manager to change your phone number');
    if (input.phone) {
      phone = normalizePhone(String(input.phone));
      if (!phone) throw new HttpError(400, 'Phone number looks wrong — try e.g. 050 123 4567 or 0772 123 456');
      if (await phoneTaken(phone, targetId)) throw new HttpError(409, 'This phone number already has an account');
    } else {
      if (loginByPhone) throw new HttpError(400, 'Phone number is required for phone sign-in');
      phone = null;
    }
    patch.phone = phone;
  }

  if (loginByPhone) {
    if (input.pin !== undefined || phoneChanging) {
      if (!isManager) throw new HttpError(403, 'Ask the office manager to reset your PIN');
      if (input.pin === undefined || input.pin === '') throw new HttpError(400, 'Enter a new PIN when changing the phone number');
      const pin = validPin(input.pin);
      authPatch.email = phoneEmail(phone!);
      authPatch.password = pinPassword(pin, phone!);
      authPatch.email_confirm = true;
    }
    if (input.email !== undefined && isManager) patch.email = input.email ? validEmail(input.email) : null;
  } else {
    if (input.email !== undefined && input.email && String(input.email).toLowerCase() !== authData.user.email) {
      const e = validEmail(input.email);
      authPatch.email = e;
      authPatch.email_confirm = true;
      patch.email = e;
    }
    if (input.password) authPatch.password = validPassword(input.password);
  }

  if (input.active !== undefined && isManager && !isSelf) {
    patch.active = !!input.active;
    authPatch.ban_duration = input.active ? 'none' : '876000h';
  }

  if (Object.keys(authPatch).length) {
    const { error } = await admin.auth.admin.updateUserById(targetId, authPatch);
    if (error) throw new HttpError(400, /already|registered|exists/i.test(error.message) ? 'That login is already used by another account' : error.message);
  }
  if (Object.keys(patch).length) {
    const { error } = await admin.from('rh_profiles').update(patch).eq('id', targetId);
    if (error) throw new HttpError(400, error.message);
  }
  const { data: fresh } = await admin.from('rh_profiles').select('*').eq('id', targetId).single();
  return fresh;
}

async function requireBootstrap(req: Request) {
  const given = req.headers.get('x-rh-secret') ?? '';
  const { data } = await admin.from('rh_config').select('value').eq('key', 'bootstrap_secret').maybeSingle();
  if (!data?.value || given.length < 24 || given !== data.value) throw new HttpError(403, 'Bootstrap is disabled');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? '');

    // ---------- secret-protected setup actions ----------
    if (action.startsWith('bootstrap.')) {
      await requireBootstrap(req);
      if (action === 'bootstrap.load_catalog') {
        if (!body.catalog?.items?.length) throw new HttpError(400, 'Catalog is empty');
        const { error } = await admin.from('rh_catalog').upsert({ id: 1, data: body.catalog, updated_at: new Date().toISOString() });
        if (error) throw new HttpError(400, error.message);
        return json({ ok: true, items: body.catalog.items.length });
      }
      if (action === 'bootstrap.create_org') {
        const { data: org, error } = await admin.from('rh_orgs').insert({
          name: String(body.name), short_name: body.short_name ?? null, is_demo: !!body.is_demo,
        }).select().single();
        if (error) throw new HttpError(400, error.message);
        if (!body.is_demo) {
          const { error: se } = await admin.rpc('rh_seed_catalog', { p_org: org.id });
          if (se) throw new HttpError(400, se.message);
        }
        return json({ ok: true, org });
      }
      if (action === 'bootstrap.create_user') {
        const profile = await createMember(String(body.org_id), body);
        return json({ ok: true, profile });
      }
      if (action === 'bootstrap.seed_demo') {
        const { error } = await admin.rpc('rh_seed_demo', { p_org: String(body.org_id) });
        if (error) throw new HttpError(400, error.message);
        return json({ ok: true });
      }
      throw new HttpError(400, 'Unknown bootstrap action');
    }

    // ---------- signed-in actions ----------
    const caller = await getCaller(req);

    if (action === 'members.create') {
      if (caller.profile.role !== 'manager') throw new HttpError(403, 'Only the office manager can add people');
      const profile = await createMember(caller.profile.org_id, body);
      return json({ ok: true, profile });
    }
    if (action === 'members.update') {
      const profile = await updateMember(caller, body);
      return json({ ok: true, profile });
    }
    if (action === 'members.delete') {
      if (caller.profile.role !== 'manager') throw new HttpError(403, 'Only the office manager can remove people');
      const id = String(body.id ?? '');
      if (!id || id === caller.user.id) throw new HttpError(400, 'You cannot remove your own account');
      const { data: target } = await admin.from('rh_profiles').select('org_id').eq('id', id).maybeSingle();
      if (!target || target.org_id !== caller.profile.org_id) throw new HttpError(404, 'Account not found');
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw new HttpError(400, error.message);
      return json({ ok: true });
    }
    throw new HttpError(400, 'Unknown action');
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = e instanceof Error ? e.message : 'Unexpected error';
    if (status === 500) console.error(e);
    return json({ error: message }, status);
  }
});
