import type { Lang } from '../lib/types';
const LOCALES: Record<Lang, string> = {
  en: 'en-GB', lg: 'en-UG', sw: 'sw-UG', ar: 'ar-AE-u-nu-latn', hi: 'hi-IN-u-nu-latn', ur: 'ur-PK-u-nu-latn', bn: 'bn-BD-u-nu-latn', ml: 'ml-IN-u-nu-latn', tl: 'fil-PH',
};
export const localeOf = (l: Lang) => LOCALES[l] ?? 'en-GB';

// Browsers ship no Luganda calendar names, so we carry them ourselves (CLDR "lg").
const LG_DAYS = ['Sabbiiti', 'Balaza', 'Lwakubiri', 'Lwakusatu', 'Lwakuna', 'Lwakutaano', 'Lwamukaaga'];
const LG_MONTHS = ['Janwaliyo', 'Febwaliyo', 'Marisi', 'Apuli', 'Maayi', 'Juuni', 'Julaayi', 'Agusito', 'Sebuttemba', 'Okitobba', 'Novemba', 'Desemba'];

/** "Tuesday, 10 November" in the cleaner's language (d = YYYY-MM-DD) */
export function longDate(d: string, lang: Lang): string {
  const [y, m, day] = d.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  if (lang === 'lg') return `${LG_DAYS[dt.getUTCDay()]}, ${day} ${LG_MONTHS[m - 1]}`;
  return new Intl.DateTimeFormat(localeOf(lang), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(dt);
}
