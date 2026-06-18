// Spell numbers out as WORDS before sending text to the TTS engine. ElevenLabs
// mispronounces bare digits ("5" comes out "feev", "d20" slurs), and number words
// give the model a clean phonetic target with steady inflection. Dice notation is
// handled first ("d20" → "d twenty", "2d8" → "two d eight"), then any standalone
// integer (damage, HP, gold, XP) becomes its word form.

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function under100(n: number): string {
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)];
  const o = n % 10;
  return o ? `${t}-${ONES[o]}` : t;
}

function under1000(n: number): string {
  if (n < 100) return under100(n);
  const h = Math.floor(n / 100);
  const r = n % 100;
  return r ? `${ONES[h]} hundred ${under100(r)}` : `${ONES[h]} hundred`;
}

/** Convert a non-negative integer (0–99,999) to its spoken word form. */
export function numberToWords(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (n < 0) return `minus ${numberToWords(-n)}`;
  if (n < 1000) return under1000(n);
  const th = Math.floor(n / 1000);
  const r = n % 1000;
  const thWords = `${under1000(th)} thousand`;
  return r ? `${thWords} ${under1000(r)}` : thWords;
}

/**
 * Replace dice notation and standalone integers in `text` with spoken word forms.
 * Leaves numbers embedded in words/identifiers and decimals untouched.
 */
export function numbersToWords(text: string): string {
  if (!text) return text;
  // Dice notation first: "d20" → "d twenty", "2d8" → "two d eight".
  let out = text.replace(/\b(\d*)d(\d{1,3})\b/gi, (_m, count: string, sides: string) =>
    (count ? `${numberToWords(parseInt(count, 10))} ` : "") + `d ${numberToWords(parseInt(sides, 10))}`);
  // Standalone integers (1–5 digits). Skip numbers inside identifiers and true
  // decimals (1.5) — but NOT a sentence-ending period after an integer ("11.").
  out = out.replace(/(?<![A-Za-z0-9.])\d{1,5}(?![A-Za-z0-9])(?!\.\d)/g, (m) => numberToWords(parseInt(m, 10)));
  return out;
}
