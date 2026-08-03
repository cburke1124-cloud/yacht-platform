import { formatPhoneNumberIntl } from 'react-phone-number-input/min';

/**
 * Formats a stored phone number for display (e.g. "+4712345678" ->
 * "+47 12 34 56 78"). Falls back to the raw string for anything that isn't
 * clean E.164 — legacy pre-normalization data was never backfilled, so this
 * must degrade gracefully rather than hide or mangle an unparseable number.
 */
export function formatPhoneDisplay(raw: string | null | undefined): string {
  if (!raw) return '';
  try {
    return formatPhoneNumberIntl(raw) || raw;
  } catch {
    return raw;
  }
}
