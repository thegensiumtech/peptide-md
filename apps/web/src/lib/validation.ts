/**
 * Shared form validation.
 *
 * Client-side validation is a courtesy — it tells someone what is wrong before
 * they wait for a round trip. The API validates the same rules again with Zod,
 * and that is the boundary that actually counts.
 */

/**
 * Email check without a regex.
 *
 * The obvious pattern (`[^\s@]+@[^\s@]+\.[^\s@]+`) backtracks on adversarial
 * input, and this runs on every keystroke of a submit. Splitting on '@' is
 * linear and rejects the same things.
 */
export function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  if (/\s/.test(trimmed)) return false;

  const parts = trimmed.split('@');
  if (parts.length !== 2) return false;

  const [local, domain] = parts as [string, string];
  if (local.length === 0 || domain.length < 3) return false;
  if (domain.startsWith('.') || domain.endsWith('.') || domain.startsWith('-')) return false;

  const dot = domain.lastIndexOf('.');
  if (dot <= 0 || dot === domain.length - 1) return false;

  // A top-level domain is at least two characters.
  return domain.length - dot - 1 >= 2;
}

/** UK and international numbers, entered however the patient likes. */
export function isValidPhone(value: string): boolean {
  const digits = value.replace(/[^\d]/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

export function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

/** Field-level messages, kept in one place so wording stays consistent. */
export const messages = {
  emailRequired: 'Enter your email address.',
  emailInvalid: 'That email address is not valid.',
  passwordRequired: 'Enter your password.',
  nameRequired: 'Tell us what to call you.',
  phoneRequired: 'We need a phone number in case we cannot reach you by email.',
  phoneInvalid: 'That phone number does not look right.',
} as const;
