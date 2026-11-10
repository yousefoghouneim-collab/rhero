// Phone sign-in for cleaners: the phone number + PIN map to a private login.
// Keep in sync with supabase/functions/rh-admin/index.ts
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
export const PHONE_DOMAIN = 'phone.rhero.app';
export const phoneEmail = (e164: string) => `${e164.slice(1)}@${PHONE_DOMAIN}`;
export const pinPassword = (pin: string, e164: string) => `rh-${pin}-${e164.slice(1)}`;
export const isPhoneLogin = (email?: string | null) => (email ?? '').endsWith('@' + PHONE_DOMAIN);

/** +971501112222 → +971 50 111 2222 · +256772123456 → +256 772 123 456 */
export function formatPhone(e164?: string | null): string {
  if (!e164) return '';
  const m = e164.match(/^\+971(\d{2})(\d{3})(\d{4})$/);
  if (m) return `+971 ${m[1]} ${m[2]} ${m[3]}`;
  const u = e164.match(/^\+256(\d{3})(\d{3})(\d{3})$/);
  if (u) return `+256 ${u[1]} ${u[2]} ${u[3]}`;
  return e164;
}
/** Pretty-print while typing: UAE 050 123 4567 · Uganda 0772 123 456 · international as typed */
export function maskPhoneInput(v: string): string {
  const d = v.replace(/[^\d+]/g, '');
  if (d.startsWith('+') || d.startsWith('00')) return d;
  const x = d.slice(0, 10);
  if (x.startsWith('07')) {
    if (x.length <= 4) return x;
    if (x.length <= 7) return `${x.slice(0, 4)} ${x.slice(4)}`;
    return `${x.slice(0, 4)} ${x.slice(4, 7)} ${x.slice(7)}`;
  }
  if (x.length <= 3) return x;
  if (x.length <= 6) return `${x.slice(0, 3)} ${x.slice(3)}`;
  return `${x.slice(0, 3)} ${x.slice(3, 6)} ${x.slice(6)}`;
}
/** The number as people type it at home: +971501234567 → 050 123 4567 · +256772123456 → 0772 123 456 */
export function localPhone(e164?: string | null): string {
  if (!e164) return '';
  if (/^\+9715\d{8}$/.test(e164)) return maskPhoneInput('0' + e164.slice(4));
  if (/^\+2567\d{8}$/.test(e164)) return maskPhoneInput('0' + e164.slice(4));
  return e164;
}
