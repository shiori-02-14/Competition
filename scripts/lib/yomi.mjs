import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const kuromoji = require("kuromoji");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const catalogPath = path.join(root, "public", "competitions.json");
const dicPath = path.join(path.dirname(require.resolve("kuromoji/package.json")), "dict");
const PUNCT = /^[\s・･·∙•、。,.，．/／|｜\-‐‑‒–—―_~～〜:：;；!！?？'’"“”「」『』（）()[\]【】〔〕［］｛｝{}<>＜＞]+$/u;
const KANJI = /[\u4e00-\u9fff々]/;

let tokenizerPromise;

function kataToHira(input) {
  return String(input).replace(/[\u30a1-\u30f6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

function tokenizer() {
  tokenizerPromise ??= new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath }).build((error, built) => (error ? reject(error) : resolve(built)));
  });
  return tokenizerPromise;
}

function tokenYomi(token) {
  const surface = token.surface_form || "";
  const reading = token.reading && token.reading !== "*" ? token.reading : surface;
  return kataToHira(reading.normalize("NFKC"));
}

async function phraseList() {
  const source = await readFile(path.join(root, "src/lib/phrases.ts"), "utf8");
  return [...source.matchAll(/"([^"\\]+)"/g)].map((match) => match[1]);
}

function sourceText(item) {
  return [item.title, item.organizer, item.summary, item.venue, item.prize, item.region, item.area, item.category, ...(item.tags ?? []), item.eligibility ?? ""]
    .filter(Boolean)
    .join("\n");
}

export async function enrichCatalog(catalog) {
  const built = await tokenizer();
  const tally = new Map();
  const words = new Set();

  const absorb = (surface, yomi, weight) => {
    const key = surface.normalize("NFKC");
    const length = [...key].length;
    if (length < 2 || length > 16 || !KANJI.test(key) || !yomi || yomi === key) return;
    let bucket = tally.get(key);
    if (!bucket) {
      bucket = new Map();
      tally.set(key, bucket);
    }
    bucket.set(yomi, (bucket.get(yomi) ?? 0) + weight);
  };

  const walk = (text, weight) => {
    const parts = [];
    let runSurface = "";
    let runYomi = "";
    const flush = () => {
      if (!runSurface) return;
      absorb(runSurface, runYomi, weight);
      const yomiLength = [...runYomi].length;
      if (yomiLength >= 3 && yomiLength <= 24) words.add(runYomi);
      runSurface = "";
      runYomi = "";
    };
    for (const token of built.tokenize(text || "")) {
      const surface = token.surface_form || "";
      if (!surface || PUNCT.test(surface)) {
        flush();
        continue;
      }
      const yomi = tokenYomi(token);
      parts.push(yomi);
      if (KANJI.test(surface)) {
        absorb(surface, yomi, weight);
        runSurface += surface;
        runYomi += yomi;
      } else {
        flush();
      }
      const yomiLength = [...yomi].length;
      if (yomiLength >= 3 && yomiLength <= 24) words.add(yomi);
    }
    flush();
    return parts.join("");
  };

  for (const phrase of await phraseList()) walk(phrase, 50);
  let longest = 0;
  for (const item of catalog.competitions ?? []) {
    const reading = walk(sourceText(item), 1).slice(0, 4000);
    if (reading) item.reading = reading;
    else delete item.reading;
    longest = Math.max(longest, reading.length);
  }

  catalog.lexicon = [...tally.entries()]
    .map(([surface, counts]) => {
      let best = "";
      let score = 0;
      for (const [yomi, count] of counts) {
        if (count > score) {
          best = yomi;
          score = count;
        }
      }
      return [surface, best];
    })
    .sort((a, b) => a[0].length - b[0].length || a[0].localeCompare(b[0], "ja"));
  catalog.words = [...words].sort((a, b) => a.localeCompare(b, "ja"));
  console.log(`読み: 語彙${catalog.lexicon.length} 単語${catalog.words.length} 最長${longest}字`);
  return catalog;
}

async function main() {
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  await enrichCatalog(catalog);
  const samples = ["奨学金", "豊橋", "ハッカソン", "東京", "グラフィック"];
  const lexicon = new Map(catalog.lexicon);
  for (const sample of samples) {
    const hit = (catalog.competitions ?? []).find((item) => `${item.title} ${item.summary}`.includes(sample));
    console.log(sample, lexicon.get(sample) ?? "(語彙なし)", hit ? `例: ${hit.title}` : "用例なし");
  }
  const temporary = `${catalogPath}.tmp`;
  await writeFile(temporary, JSON.stringify(catalog));
  await rename(temporary, catalogPath);
  console.log(`保存 ${catalog.competitions.length}件`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
