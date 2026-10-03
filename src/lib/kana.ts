// 検索文字列を、漢字の読みとひらがな・カタカナの違いをまたいで比べる。

const VOWEL = new Map<string, "a" | "i" | "u" | "e" | "o">();

function addRow(kana: string, vowels: string) {
  [...kana].forEach((ch, index) => {
    const vowel = vowels[index];
    if (vowel === "a" || vowel === "i" || vowel === "u" || vowel === "e" || vowel === "o") VOWEL.set(ch, vowel);
  });
}

addRow("あいうえお", "aiueo");
addRow("かきくけこ", "aiueo");
addRow("さしすせそ", "aiueo");
addRow("たちつてと", "aiueo");
addRow("なにぬねの", "aiueo");
addRow("はひふへほ", "aiueo");
addRow("まみむめも", "aiueo");
addRow("やゆよ", "auo");
addRow("らりるれろ", "aiueo");
addRow("わを", "ao");
addRow("ぁぃぅぇぉ", "aiueo");
addRow("ゃゅょ", "auo");
addRow("がぎぐげご", "aiueo");
addRow("ざじずぜぞ", "aiueo");
addRow("だぢづでど", "aiueo");
addRow("ばびぶべぼ", "aiueo");
addRow("ぱぴぷぺぽ", "aiueo");
addRow("ゔ", "u");

const SEPARATORS = /[\s・･·∙•、。,.，．/／|｜\-‐‑‒–—―_~～〜:：;；!！?？'’"“”「」『』（）()[\]【】〔〕［］｛｝{}<>＜＞]+/g;

let searchGen = 0;
let lexicon = new Map<string, string>();
let surfaceLengths: number[] = [];
let phraseList: string[] = [];
let phraseMap = new Map<string, string>();
let maxPhrase = 0;
let wordSet = new Set<string>();
let maxWord = 0;

export function searchGeneration() {
  return searchGen;
}

export function registerPhrases(phrases: string[]) {
  phraseList = phrases;
  rebuildPhrases();
}

export function installSearchIndex(index?: { lexicon?: [string, string][]; words?: string[] }) {
  const next = new Map<string, string>();
  let maxSurface = 0;
  for (const pair of index?.lexicon ?? []) {
    const [surface, yomi] = pair;
    if (!surface || !yomi) continue;
    const key = surface.normalize("NFKC");
    next.set(key, yomi);
    maxSurface = Math.max(maxSurface, [...key].length);
  }
  lexicon = next;
  surfaceLengths = [];
  for (let length = maxSurface; length >= 2; length -= 1) surfaceLengths.push(length);

  wordSet = new Set();
  maxWord = 0;
  const remember = (value: string) => {
    const text = soft(value);
    const length = [...text].length;
    if (length < 2 || length > 24) return;
    wordSet.add(text);
    maxWord = Math.max(maxWord, length);
  };
  for (const yomi of lexicon.values()) remember(yomi);
  for (const word of index?.words ?? []) remember(word);
  searchGen += 1;
  rebuildPhrases();
}

export function soft(input: string) {
  return expandCho(fold(input)).replace(/[・･·]/g, "");
}

export function norm(input: string) {
  return expandCho(fold(input).replace(SEPARATORS, ""));
}

export function squash(input: string) {
  return fold(input)
    .replace(SEPARATORS, "")
    .replace(/[ー～〜]/g, "");
}

export function collapseVowels(input: string) {
  return input.replace(/あ+/g, "あ").replace(/い+/g, "い").replace(/う+/g, "う").replace(/え+/g, "え").replace(/お+/g, "お");
}

export function canonicalize(input: string) {
  const text = soft(input.trim());
  if (!phraseMap.size) return text;
  const chars = [...text];
  let index = 0;
  let out = "";
  while (index < chars.length) {
    let replaced = false;
    const room = chars.length - index;
    for (let length = Math.min(maxPhrase, room); length >= 2; length -= 1) {
      const slice = chars.slice(index, index + length).join("");
      const surface = phraseMap.get(slice);
      if (!surface || insideLongerWord(chars, index, length)) continue;
      out += surface;
      index += length;
      replaced = true;
      break;
    }
    if (!replaced) {
      out += chars[index];
      index += 1;
    }
  }
  return out;
}

export function tokenHits(hayNorm: string, haySquash: string, hayCollapsed: string, token: string) {
  const needles = new Set<string>();
  for (const source of [token, toReading(token)]) {
    const normalized = norm(source);
    const squashed = squash(source);
    const collapsed = collapseVowels(normalized);
    const trimmed = trimLongVowel(normalized);
    if (normalized) needles.add(`n:${normalized}`);
    if (squashed) needles.add(`s:${squashed}`);
    if (collapsed) needles.add(`c:${collapsed}`);
    if (trimmed.length >= 2) needles.add(`n:${trimmed}`);
  }
  if (!needles.size) return true;
  for (const needle of needles) {
    const body = needle.slice(2);
    if (needle.startsWith("n:") && hayNorm.includes(body)) return true;
    if (needle.startsWith("s:") && haySquash.includes(body)) return true;
    if (needle.startsWith("c:") && hayCollapsed.includes(body)) return true;
  }
  return false;
}

function rebuildPhrases() {
  const next = new Map<string, string>();
  for (const phrase of phraseList) {
    const yomi = soft(toReading(phrase));
    if ([...yomi].length < 2 || /[\u4e00-\u9fff]/.test(yomi)) continue;
    if (yomi === phrase) continue;
    if (!next.has(yomi)) next.set(yomi, phrase);
  }
  phraseMap = next;
  maxPhrase = 0;
  for (const yomi of phraseMap.keys()) maxPhrase = Math.max(maxPhrase, [...yomi].length);
}

function toReading(input: string) {
  const chars = [...input.normalize("NFKC")];
  let index = 0;
  let out = "";
  while (index < chars.length) {
    let used = 0;
    let yomi = "";
    if (isKanji(chars[index] ?? "")) {
      for (const length of surfaceLengths) {
        if (length > chars.length - index) continue;
        const slice = chars.slice(index, index + length).join("");
        const hit = lexicon.get(slice);
        if (!hit) continue;
        yomi = hit;
        used = length;
        break;
      }
    }
    if (used) {
      out += yomi;
      index += used;
    } else {
      out += chars[index];
      index += 1;
    }
  }
  return out;
}

function insideLongerWord(chars: string[], start: number, length: number) {
  if (maxWord <= length) return false;
  const end = start + length;
  const from = Math.max(0, end - maxWord);
  for (let begin = from; begin <= start; begin += 1) {
    const limit = Math.min(chars.length, begin + maxWord);
    const first = begin === start ? end + 1 : end;
    for (let stop = limit; stop >= first; stop -= 1) {
      if (wordSet.has(chars.slice(begin, stop).join(""))) return true;
    }
  }
  return false;
}

function trimLongVowel(input: string) {
  const chars = [...input];
  while (chars.length >= 2) {
    const last = chars[chars.length - 1] ?? "";
    const prev = chars[chars.length - 2] ?? "";
    const vowel = VOWEL.get(prev);
    const drops =
      (vowel === "a" && last === "あ") ||
      (vowel === "i" && last === "い") ||
      (vowel === "u" && last === "う") ||
      (vowel === "e" && (last === "い" || last === "え")) ||
      (vowel === "o" && (last === "う" || last === "お"));
    if (!drops) break;
    chars.pop();
  }
  return chars.join("");
}

function fold(input: string) {
  return kataToHira(input.normalize("NFKC").toLowerCase());
}

function kataToHira(input: string) {
  return input.replace(/[\u30a1-\u30f6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

function expandCho(input: string) {
  let out = "";
  for (const ch of input) {
    if ((ch === "ー" || ch === "～" || ch === "〜") && out) {
      const vowel = VOWEL.get(out[out.length - 1] ?? "");
      if (vowel === "a") out += "あ";
      else if (vowel === "i" || vowel === "e") out += "い";
      else if (vowel === "u" || vowel === "o") out += "う";
      continue;
    }
    out += ch;
  }
  return out;
}

function isKanji(ch: string) {
  return /[\u4e00-\u9fff々]/.test(ch);
}
