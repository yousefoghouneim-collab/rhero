import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LANGS, STRINGS, type StrKey } from './strings';
import type { I18n, Lang } from '../lib/types';

type Ctx = {
  lang: Lang;
  dir: 'ltr' | 'rtl';
  setLang: (l: Lang) => void;
  t: (k: StrKey, vars?: Record<string, string | number>) => string;
  tr: (base: string, i18n?: I18n | null) => string;
};
const I18nCtx = createContext<Ctx | null>(null);
const LS = 'rhero-lang';

export function readSavedLang(): Lang {
  try {
    const v = localStorage.getItem(LS) as Lang | null;
    if (v && LANGS.some((l) => l.code === v)) return v;
  } catch { /* ignore */ }
  return 'en';
}

export function I18nProvider({ forced, children }: { forced?: Lang | null; children: ReactNode }) {
  const [chosen, setChosen] = useState<Lang>(readSavedLang);
  const lang = forced ?? chosen;
  const dir = LANGS.find((l) => l.code === lang)?.dir ?? 'ltr';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const value = useMemo<Ctx>(() => ({
    lang,
    dir,
    setLang: (l) => {
      setChosen(l);
      try { localStorage.setItem(LS, l); } catch { /* ignore */ }
    },
    t: (k, vars) => {
      let s: string = STRINGS[k]?.[lang] || STRINGS[k]?.en || k;
      if (vars) for (const [vk, vv] of Object.entries(vars)) s = s.split(`{${vk}}`).join(String(vv));
      return s;
    },
    tr: (base, i18n) => (lang !== 'en' && i18n?.[lang]) || base,
  }), [lang, dir]);

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n(): Ctx {
  const c = useContext(I18nCtx);
  if (!c) throw new Error('I18nProvider missing');
  return c;
}
