import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LANGS, STRINGS, type StrKey } from './strings';
import type { I18n, Lang } from '../lib/types';

/**
 * RHero always speaks English first. A person who picks another language (cleaners: set by the office
 * manager or on their phone) sees it underneath the English — "Today / Leero" — so everyone uses the
 * same names as the office and nothing depends on a translation alone.
 */
type Vars = Record<string, string | number>;
type Ctx = {
  /** primary language of the interface (always English) */
  lang: Lang;
  /** the language the person picked; shown underneath the English when it isn't English */
  pref: Lang;
  second: Lang | null;
  dir2: 'ltr' | 'rtl';
  setLang: (l: Lang) => void;
  t: (k: StrKey, vars?: Vars) => string;
  /** the same text in the second language (null when there is none) */
  ts: (k: StrKey, vars?: Vars) => string | null;
  /** both on one line, "Saved · Kiterekeddwa" (toasts, placeholders) */
  tb: (k: StrKey, vars?: Vars) => string;
  tr: (base: string, i18n?: I18n | null) => string;
  trs: (base: string, i18n?: I18n | null) => string | null;
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

const fill = (s: string, vars?: Vars) => {
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
};

export function I18nProvider({ pref: fixed, children }: { pref?: Lang | null; children: ReactNode }) {
  const [chosen, setChosen] = useState<Lang>(readSavedLang);
  const pref = fixed ?? chosen;
  const second = pref !== 'en' && LANGS.some((l) => l.code === pref) ? pref : null;
  const dir2 = LANGS.find((l) => l.code === second)?.dir ?? 'ltr';

  useEffect(() => {
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  }, []);

  const value = useMemo<Ctx>(() => ({
    lang: 'en',
    pref,
    second,
    dir2,
    setLang: (l) => {
      setChosen(l);
      try { localStorage.setItem(LS, l); } catch { /* ignore */ }
    },
    t: (k, vars) => fill(STRINGS[k]?.en ?? k, vars),
    ts: (k, vars) => {
      const s = second ? STRINGS[k]?.[second] : null;
      return s ? fill(s, vars) : null;
    },
    tb: (k, vars) => {
      const en = fill(STRINGS[k]?.en ?? k, vars);
      const s = second ? STRINGS[k]?.[second] : null;
      return s ? `${en} · ${fill(s, vars)}` : en;
    },
    tr: (base) => base,
    trs: (base, i18n) => (second && i18n?.[second] && i18n[second] !== base ? i18n[second]! : null),
  }), [pref, second, dir2]);

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n(): Ctx {
  const c = useContext(I18nCtx);
  if (!c) throw new Error('I18nProvider missing');
  return c;
}

const subCls = 'block text-[0.8em] font-medium leading-snug opacity-75';

/** English text with the second language on the line below. */
export function Bi({ k, vars, sub, stack }: { k: StrKey; vars?: Vars; sub?: string; stack?: boolean | 'center' }) {
  const { t, ts, second, dir2 } = useI18n();
  return <Pair main={t(k, vars)} other={ts(k, vars)} lang={second} dir={dir2} sub={sub} stack={stack} />;
}

/** A name from the database (area, round, task) in English with its translation below. */
export function BiName({ base, i18n, sub, stack }: { base: string; i18n?: I18n | null; sub?: string; stack?: boolean | 'center' }) {
  const { trs, second, dir2 } = useI18n();
  return <Pair main={base} other={trs(base, i18n)} lang={second} dir={dir2} sub={sub} stack={stack} />;
}

/** Only the second-language line (renders nothing in English-only mode). */
export function Second({ k, vars, className }: { k: StrKey; vars?: Vars; className?: string }) {
  const { ts, second, dir2 } = useI18n();
  const s = ts(k, vars);
  if (!s || !second) return null;
  return <span lang={second} dir={dir2} className={className ?? subCls}>{s}</span>;
}

function Pair({ main, other, lang, dir, sub, stack }: { main: string; other: string | null; lang: Lang | null; dir: 'ltr' | 'rtl'; sub?: string; stack?: boolean | 'center' }) {
  if (!other || !lang || other === main) return <>{main}</>;
  const line = <span lang={lang} dir={dir} className={sub ?? subCls}>{other}</span>;
  // inside flex rows (buttons, chips) the two lines need their own column
  if (stack) return <span className={`flex min-w-0 flex-col leading-tight${stack === 'center' ? ' items-center text-center' : ''}`}><span>{main}</span>{line}</span>;
  return <>{main}{line}</>;
}
