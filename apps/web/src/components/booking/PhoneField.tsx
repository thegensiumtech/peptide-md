'use client';

import { useMemo, useState } from 'react';
import { COUNTRIES, dialCodeForCountry } from '@peptide/shared';
import { Select } from '@/components/ui/Field';

/**
 * Phone entry: a country dialling code and a number, not one free-text box.
 *
 * The plain `<input type="tel">` this replaces accepted anything, so a slip on
 * the keypad produced a forty-digit "number" that was never going to reach the
 * patient. Splitting the code out fixes three things at once: the code is
 * chosen rather than typed, the number field takes digits only and is capped at
 * what E.164 allows, and the code defaults to the patient's own country so most
 * people never touch it.
 *
 * The combined value is written to a hidden input named `phone`, so the form
 * around it keeps reading one field and nothing downstream changes.
 */

// E.164 allows at most 15 digits including the country code.
const E164_MAX = 15;

const SORTED = [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name));

export function PhoneField({
  id = 'phone',
  defaultCountry,
  invalid = false,
}: {
  id?: string;
  /** ISO alpha-2 to preselect, e.g. the patient's Stripe billing country. */
  defaultCountry?: string | null;
  invalid?: boolean;
}) {
  const initialCode =
    dialCodeForCountry(defaultCountry) ?? dialCodeForCountry('GB') ?? '44';
  const initialCountry =
    (defaultCountry && dialCodeForCountry(defaultCountry) ? defaultCountry.toUpperCase() : null) ??
    'GB';

  const [country, setCountry] = useState(initialCountry);
  const [digits, setDigits] = useState('');

  const dialCode = dialCodeForCountry(country) ?? initialCode;

  // The number field never accepts more digits than E.164 leaves once the
  // country code is spent.
  const maxNationalDigits = Math.max(4, E164_MAX - dialCode.length);

  // Empty when there is no number, so the form's required check still fails on
  // a bare country code rather than seeing "+44 " as a filled field.
  const combined = digits ? `+${dialCode} ${digits}` : '';

  const options = useMemo(
    () =>
      SORTED.map((c) => (
        <option key={c.code} value={c.code}>
          {c.name} (+{c.dialCode})
        </option>
      )),
    []
  );

  return (
    <div className="flex gap-2">
      <div className="w-40 shrink-0">
        <Select
          aria-label="Country dialling code"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
        >
          {options}
        </Select>
      </div>

      <div className="relative flex-1">
        <span
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted"
        >
          +{dialCode}
        </span>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          aria-invalid={invalid}
          value={digits}
          maxLength={maxNationalDigits}
          onChange={(event) => setDigits(event.target.value.replace(/[^\d]/g, '').slice(0, maxNationalDigits))}
          placeholder="7700 900000"
          className="min-h-11 w-full rounded border border-line bg-surface py-2 pr-3 font-mono text-sm text-ink outline-none transition-colors focus:border-ink"
          style={{ paddingLeft: `${dialCode.length * 0.62 + 1.6}rem` }}
        />
      </div>

      {/* What the form actually submits. */}
      <input type="hidden" name="phone" value={combined} />
    </div>
  );
}
