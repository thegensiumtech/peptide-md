/**
 * Consultation length, written out.
 *
 * The duration is an admin setting, so copy that spells it out ("Thirty
 * minutes with the doctor") is built from the setting rather than typed into
 * the page. Typed-in copy is how the fee and length ended up disagreeing
 * across fifteen places when they last changed.
 */

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** 30 -> 'thirty', 45 -> 'forty-five'. Falls back to digits outside 0 to 99. */
export function numberInWords(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 99) return String(value);
  if (value < 20) return ONES[value]!;
  const tens = TENS[Math.floor(value / 10)]!;
  const ones = value % 10;
  return ones === 0 ? tens : `${tens}-${ONES[ones]}`;
}

/** 30 -> 'thirty minutes', or 'Thirty minutes' when it opens a sentence. */
export function minutesInWords(minutes: number, options: { capitalise?: boolean } = {}): string {
  const words = `${numberInWords(minutes)} minutes`;
  return options.capitalise ? words.charAt(0).toUpperCase() + words.slice(1) : words;
}
