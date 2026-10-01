// Tables contain assigned Unicode characters only; no inferred Sanskrit forms.
const chars = (points) => points.map((cp) => cp === null ? null : String.fromCodePoint(cp));
const vowels = ['a', 'ā', 'i', 'ī', 'u', 'ū', 'ṛ', 'ṝ', 'ḷ', 'ḹ', 'e', 'ai', 'o', 'au'];
const consonants = [
  'k', 'kh', 'g', 'gh', 'ṅ', 'c', 'ch', 'j', 'jh', 'ñ',
  'ṭ', 'ṭh', 'ḍ', 'ḍh', 'ṇ', 't', 'th', 'd', 'dh', 'n',
  'p', 'ph', 'b', 'bh', 'm', 'y', 'r', 'l', 'v', 'ś', 'ṣ', 's', 'h',
];
const map = (keys, values) => new Map(keys.map((key, i) => [key, values[i]]));
const sequence = (start, count) => chars(Array.from({ length: count }, (_, i) => start + i));
const siddhamScript = {
  independent: map(vowels, sequence(0x11580, 14)),
  // U+115B6/B7 are unassigned: there are no vocalic L/LL vowel signs.
  signs: map(vowels, ['', ...chars([
    0x115af, 0x115b0, 0x115b1, 0x115b2, 0x115b3, 0x115b4, 0x115b5,
    null, null, 0x115b8, 0x115b9, 0x115ba, 0x115bb,
  ])]),
  consonants: map(consonants, sequence(0x1158e, 33)),
  marks: map(['ṃ', 'ḥ'], chars([0x115bd, 0x115be])),
  virama: String.fromCodePoint(0x115bf),
  separator: ' ／ ',
};
const devanagariScript = {
  independent: map(vowels, chars([
    0x0905, 0x0906, 0x0907, 0x0908, 0x0909, 0x090a, 0x090b,
    0x0960, 0x090c, 0x0961, 0x090f, 0x0910, 0x0913, 0x0914,
  ])),
  signs: map(vowels, ['', ...chars([
    0x093e, 0x093f, 0x0940, 0x0941, 0x0942, 0x0943, 0x0944,
    0x0962, 0x0963, 0x0947, 0x0948, 0x094b, 0x094c,
  ])]),
  consonants: map(consonants, chars([
    0x0915, 0x0916, 0x0917, 0x0918, 0x0919, 0x091a, 0x091b, 0x091c, 0x091d, 0x091e,
    0x091f, 0x0920, 0x0921, 0x0922, 0x0923, 0x0924, 0x0925, 0x0926, 0x0927, 0x0928,
    0x092a, 0x092b, 0x092c, 0x092d, 0x092e, 0x092f, 0x0930, 0x0932, 0x0935,
    0x0936, 0x0937, 0x0938, 0x0939,
  ])),
  marks: map(['ṃ', 'ḥ'], chars([0x0902, 0x0903])),
  virama: '\u094d',
  separator: ' \u0964 ',
};
const tokens = [...consonants, ...vowels, 'ṃ', 'ḥ'].sort((a, b) => b.length - a.length);
const stripJoiners = (s) => s.replace(/[-'’ʼ`]/g, '');

export function normalizeIast(s) {
  return s.normalize('NFC').toLowerCase().replace(/ṁ/g, 'ṃ')
    .replace(/ri\u0325|r\u0325/g, 'ṛ').replace(/l\u0325/g, 'ḷ').trim().normalize('NFC');
}

function tokenize(word) {
  const src = normalizeIast(word);
  const result = [];
  for (let i = 0; i < src.length;) {
    const token = tokens.find((t) => src.startsWith(t, i));
    if (!token) return null;
    result.push(token);
    i += token.length;
  }
  return result;
}

function transliterate(word, script) {
  const parsed = tokenize(word);
  if (!parsed) return '';
  let out = '';
  let pending = [];
  const flush = (sign) => {
    if (pending.length) out += pending.join(script.virama) + sign;
    pending = [];
  };
  for (const token of parsed) {
    if (script.consonants.has(token)) pending.push(script.consonants.get(token));
    else if (script.independent.has(token)) {
      if (!pending.length) out += script.independent.get(token);
      else {
        const sign = script.signs.get(token);
        if (sign === null) return '';
        flush(sign);
      }
    } else {
      // Preserve mandala's inherent-a behavior for a consonant before ṃ/ḥ.
      flush('');
      out += script.marks.get(token);
    }
  }
  flush(script.virama);
  return out;
}

function transliteratePhrase(phrase, script) {
  if (!phrase) return '';
  const out = [];
  for (const token of phrase.split(/(\s+|／|·)/)) {
    if (!token) continue;
    if (/^(\s+|／|·)$/.test(token)) {
      out.push(token === '／' ? script.separator : ' ');
      continue;
    }
    const word = stripJoiners(token);
    if (!word) continue;
    const converted = transliterate(word, script);
    if (!converted) return '';
    out.push(converted);
  }
  return out.join('').replace(/\s+/g, ' ').trim();
}

export const iastToSiddham = (word) => transliterate(word, siddhamScript);
export const iastPhraseToSiddham = (phrase) => transliteratePhrase(phrase, siddhamScript);
export const siddham = iastToSiddham;
export const siddhamPhrase = iastPhraseToSiddham;
export const iastToDevanagari = (word) => transliterate(word, devanagariScript);
export const iastPhraseToDevanagari = (phrase) => transliteratePhrase(phrase, devanagariScript);

const invert = (table) => new Map([...table].filter(([, v]) => v).map(([k, v]) => [v, k]));
const reverseIndependent = invert(siddhamScript.independent);
const reverseConsonants = invert(siddhamScript.consonants);
const reverseSigns = invert(siddhamScript.signs);
const reverseMarks = invert(siddhamScript.marks);

export function siddhamToIast(str) {
  let out = '';
  let pending = false;
  const flush = () => {
    if (pending) out += 'a';
    pending = false;
  };
  for (const char of str) {
    if (reverseConsonants.has(char)) {
      flush();
      out += reverseConsonants.get(char);
      pending = true;
    } else if (reverseIndependent.has(char)) {
      flush();
      out += reverseIndependent.get(char);
    } else if (reverseSigns.has(char)) {
      if (!pending) return null;
      out += reverseSigns.get(char);
      pending = false;
    } else if (char === siddhamScript.virama) {
      if (!pending) return null;
      pending = false;
    } else if (reverseMarks.has(char)) {
      flush();
      out += reverseMarks.get(char);
    } else return null;
  }
  flush();
  return out;
}

export function syllabify(word) {
  const parsed = tokenize(stripJoiners(word));
  if (!parsed) return null;
  const result = [];
  let onset = '';
  let canMark = false;
  for (const token of parsed) {
    if (siddhamScript.consonants.has(token)) {
      onset += token;
      canMark = false;
    } else if (siddhamScript.independent.has(token)) {
      result.push(onset + token);
      onset = '';
      canMark = true;
    } else {
      if (!canMark) return null;
      result[result.length - 1] += token;
      canMark = false;
    }
  }
  if (onset) {
    if (!result.length) return null;
    result[result.length - 1] += onset;
  }
  return result;
}
