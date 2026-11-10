import { supabase } from './supabase';
import { normalizePhone, phoneEmail, pinPassword } from './phone';

export async function signInWithPhone(phoneRaw: string, pin: string) {
  const phone = normalizePhone(phoneRaw);
  if (!phone) throw new Error('phone');
  const { error } = await supabase.auth.signInWithPassword({ email: phoneEmail(phone), password: pinPassword(pin.trim(), phone) });
  if (error) throw error;
}
export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw error;
}

// Demo accounts (sample workspace, reset daily)
export const DEMO = {
  manager: { email: 'dina@demo.rhero.app', password: 'RHero-demo-2026', name: 'Dina Maged' },
  cleaner1: { phone: '050 111 1111', pin: '1111', name: 'Grace Nakato' },
  cleaner2: { phone: '050 222 2222', pin: '2222', name: 'Esther Akello' },
};
