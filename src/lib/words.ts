const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** Spells whole numbers below one thousand the way editorial prose would. */
export function numberToWords(n: number): string {
  const value = Math.floor(Math.abs(n));
  if (value >= 1000) return value.toLocaleString('en');
  if (value < 20) return ONES[value] ?? String(value);
  if (value < 100) {
    const tens = TENS[Math.floor(value / 10)] ?? '';
    const ones = value % 10;
    return ones ? `${tens}-${ONES[ones]}` : tens;
  }
  const hundreds = `${ONES[Math.floor(value / 100)]} hundred`;
  const rest = value % 100;
  return rest ? `${hundreds} and ${numberToWords(rest)}` : hundreds;
}

export const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
