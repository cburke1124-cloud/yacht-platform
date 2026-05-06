/**
 * Browser locale detection + unit/currency preference utilities.
 * Safe to import in both client components (uses typeof checks for SSR safety).
 */

// Language prefix → { currency, units }
const LANG_DEFAULTS: Record<string, { currency: string; units: 'imperial' | 'metric' }> = {
  de: { currency: 'EUR', units: 'metric' },
  fr: { currency: 'EUR', units: 'metric' },
  it: { currency: 'EUR', units: 'metric' },
  es: { currency: 'EUR', units: 'metric' },
  nl: { currency: 'EUR', units: 'metric' },
  pt: { currency: 'EUR', units: 'metric' },
  pl: { currency: 'EUR', units: 'metric' },
  cs: { currency: 'EUR', units: 'metric' },
  sk: { currency: 'EUR', units: 'metric' },
  hu: { currency: 'EUR', units: 'metric' },
  ro: { currency: 'EUR', units: 'metric' },
  bg: { currency: 'EUR', units: 'metric' },
  hr: { currency: 'EUR', units: 'metric' },
  sl: { currency: 'EUR', units: 'metric' },
  el: { currency: 'EUR', units: 'metric' },
  fi: { currency: 'EUR', units: 'metric' },
  et: { currency: 'EUR', units: 'metric' },
  lv: { currency: 'EUR', units: 'metric' },
  lt: { currency: 'EUR', units: 'metric' },
  sv: { currency: 'SEK', units: 'metric' },
  nb: { currency: 'NOK', units: 'metric' },
  da: { currency: 'DKK', units: 'metric' },
  tr: { currency: 'USD', units: 'metric' },
  ja: { currency: 'JPY', units: 'metric' },
  zh: { currency: 'CNY', units: 'metric' },
  ko: { currency: 'USD', units: 'metric' },
  ru: { currency: 'USD', units: 'metric' },
  ar: { currency: 'AED', units: 'metric' },
};

// Full locale (lang-REGION) overrides — checked before the language prefix
const REGION_DEFAULTS: Record<string, { currency: string; units: 'imperial' | 'metric' }> = {
  'en-US': { currency: 'USD', units: 'imperial' },
  'en-CA': { currency: 'CAD', units: 'imperial' },
  'en-GB': { currency: 'GBP', units: 'metric' },
  'en-AU': { currency: 'AUD', units: 'metric' },
  'en-NZ': { currency: 'NZD', units: 'metric' },
  'en-SG': { currency: 'SGD', units: 'metric' },
  'en-HK': { currency: 'HKD', units: 'metric' },
  'en-IN': { currency: 'USD', units: 'metric' },
  'pt-BR': { currency: 'BRL', units: 'metric' },
  'es-MX': { currency: 'MXN', units: 'metric' },
  'es-US': { currency: 'USD', units: 'imperial' },
  'zh-TW': { currency: 'USD', units: 'metric' },
  'zh-HK': { currency: 'HKD', units: 'metric' },
};

export interface LocaleDefaults {
  currency: string;
  units: 'imperial' | 'metric';
  language: string;
}

/** Detect sensible defaults from the browser's navigator.language. */
export function detectLocaleDefaults(): LocaleDefaults {
  if (typeof navigator === 'undefined') {
    return { currency: 'USD', units: 'imperial', language: 'en' };
  }

  const raw = navigator.language || 'en-US';
  const language = raw.split('-')[0].toLowerCase();

  // Exact region match first
  if (REGION_DEFAULTS[raw]) {
    return { ...REGION_DEFAULTS[raw], language };
  }

  // Language prefix match
  if (LANG_DEFAULTS[language]) {
    return { ...LANG_DEFAULTS[language], language };
  }

  // Default: USD imperial (en-US and other unsupported locales)
  return { currency: 'USD', units: 'imperial', language };
}

/**
 * Return the user's preferred currency.
 * Priority: localStorage > backend preference cache > browser locale detection.
 */
export function getPreferredCurrency(): string {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('preferredCurrency');
    if (saved) return saved;
  }
  return detectLocaleDefaults().currency;
}

/**
 * Return the user's preferred unit system.
 * Priority: localStorage > backend preference cache > browser locale detection.
 */
export function getPreferredUnits(): 'imperial' | 'metric' {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('preferredUnits') as 'imperial' | 'metric' | null;
    if (saved === 'imperial' || saved === 'metric') return saved;
  }
  return detectLocaleDefaults().units;
}

/** Persist locale preferences to localStorage so all pages pick them up immediately. */
export function saveLocaleToStorage(currency: string, units: string, language: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('preferredCurrency', currency);
    localStorage.setItem('preferredUnits', units);
    localStorage.setItem('preferredLanguage', language);
  }
}

// ─── Unit conversion helpers ──────────────────────────────────────────────────

export function feetToMeters(ft: number): number {
  return Math.round(ft * 0.3048 * 10) / 10;
}

export function gallonsToLiters(gal: number): number {
  return Math.round(gal * 3.78541);
}

export function lbsToKg(lbs: number): number {
  return Math.round(lbs * 0.453592);
}

export function knotsToKmh(kts: number): number {
  return Math.round(kts * 1.852 * 10) / 10;
}

// ─── Display-string formatting helpers ───────────────────────────────────────

/** Format a feet value as "X ft" or "X m" depending on unit preference. */
export function fmtLength(
  feet: number | undefined | null,
  units: 'imperial' | 'metric',
): string | null {
  if (!feet) return null;
  return units === 'metric' ? `${feetToMeters(feet)} m` : `${feet} ft`;
}

/** Format a gallons value as "X gal" or "X L" depending on unit preference. */
export function fmtCapacity(
  gallons: number | undefined | null,
  units: 'imperial' | 'metric',
): string | null {
  if (!gallons) return null;
  return units === 'metric'
    ? `${gallonsToLiters(gallons).toLocaleString()} L`
    : `${Math.round(gallons).toLocaleString()} gal`;
}

/** Format a pounds value as "X lbs" or "X kg" depending on unit preference. */
export function fmtWeight(
  lbs: number | undefined | null,
  units: 'imperial' | 'metric',
): string | null {
  if (!lbs) return null;
  return units === 'metric'
    ? `${lbsToKg(lbs).toLocaleString()} kg`
    : `${Math.round(lbs).toLocaleString()} lbs`;
}

/** Format a fuel burn rate as "X gph" or "X lph" depending on unit preference. */
export function fmtFuelBurn(
  gph: number | undefined | null,
  units: 'imperial' | 'metric',
): string | null {
  if (!gph) return null;
  return units === 'metric'
    ? `${Math.round(gph * 3.78541)} lph`
    : `${gph} gph`;
}
