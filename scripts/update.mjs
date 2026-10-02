import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonUrl, decodeHtml, inferCategory, isCompetitionLike, normalize, richness, titleKey } from "./lib/normalize.mjs";
import { fetchGaxi, fetchHackathonJapan, fetchJdn, fetchTechplay } from "./lib/sources.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "public", "competitions.json");
const oncePerDayFlag = process.argv.includes("--once-per-day");
const lockPath = path.join(root, "data", "update.lock");

function tokyoDay(value) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

const UA = "challenge-zukan/1.0 (daily public-event catalog)";
const TYPE_LABEL = {
  hackathon: "ハッカソン",
  bizcon: "ビジコン",
  academia: "学術",
  acceleration: "アクセラレーション",
  startup: "スタートアップ",
  networking: "交流会",
  unknown: "その他",
};

const QUERIES = [
  "ハッカソン",
  "アイデアソン",
  "ビジネスコンテスト",
  "ピッチコンテスト",
  "コンペティション",
  "アイデアコンテスト",
  "ビジネスプラン",
  "デザインアワード",
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url, accept = "text/html") {
  const response = await fetch(url, {
    headers: { "User-Agent": UA, Accept: accept },
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url, "application/json"));
}

function isNoise(title) {
  return /弁当|懇親会|飲み会|忘年会|新年会/.test(title || "");
}

function isoDate(value) {
  if (!value) return "";
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

async function fetchNuestar() {
  const rows = await fetchJson("https://competition-bot.vercel.app/api/competitions");
  if (!Array.isArray(rows)) throw new Error("NueStarの応答が一覧ではありません");
  return rows
    .filter((row) => row?.name && row?.url)
    .map((row) =>
      normalize({
        id: row.id,
        title: row.name,
        organizer: row.organizer,
        summary: row.description,
        url: row.url,
        image: row.image_url || "",
        category: TYPE_LABEL[row.type] || inferCategory(`${row.name} ${row.description || ""}`),
        deadline: row.deadline_date || "",
        deadlineText: row.deadline || "",
        starts: row.event_date_date || "",
        startsText: row.event_date || "",
        venue: row.venue || "",
        prize: row.prize || "",
        prizeAmount: row.prize_amount,
        target: row.target || "",
      }),
    )
    .map((item) => ({ ...item, origin: "nuestar" }));
}

function parseConnpass(html) {
  return html
    .split('class="event_thumbnail"')
    .slice(1)
    .map((part) => {
      const url = part.match(/class="url summary" href="([^"]+)"/)?.[1] || "";
      const title = decodeHtml(part.match(/class="url summary" href="[^"]+">([^<]+)/)?.[1] || "");
      const start = part.match(/class="dtstart"><span class="value-title" title="([^"]+)"/)?.[1] || "";
      const place = decodeHtml(
        part.match(/class="event_place location"[\s\S]*?<span class="icon_place">\s*([^<]+)/)?.[1] || "",
      );
      const owner = decodeHtml(
        part.match(/class="event_owner"[\s\S]*?<img[^>]*>\s*([^<]+)<\/a>/)?.[1] || "",
      );
      const closed = part.includes("label_status_event close");
      return { url, title, start, place, owner, closed };
    })
    .filter((item) => item.url && item.title && !item.closed);
}

async function fetchConnpass() {
  const today = new Date();
  const startFrom = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const found = [];
  for (const query of QUERIES) {
    for (let page = 1; page <= 3; page += 1) {
      const url = `https://connpass.com/search/?q=${encodeURIComponent(query)}&start_from=${startFrom}&page=${page}`;
      const html = await fetchText(url);
      const batch = parseConnpass(html);
      if (!batch.length) break;
      found.push(...batch);
      await sleep(700);
    }
  }
  const seen = new Set();
  return found
    .filter((item) => {
      const key = canonUrl(item.url);
      if (seen.has(key) || isNoise(item.title) || !isCompetitionLike(`${item.title} ${item.place}`)) return false;
      seen.add(key);
      return true;
    })
    .map((item) => ({
      ...normalize({
        title: item.title,
        organizer: item.owner,
        summary: item.place,
        url: item.url,
        venue: item.place,
        starts: isoDate(item.start),
        deadline: isoDate(item.start),
        category: inferCategory(item.title),
      }),
      origin: "connpass",
    }));
}

async function fetchDoorkeeper() {
  const found = [];
  for (const query of QUERIES) {
    for (let page = 1; page <= 2; page += 1) {
      const url = `https://api.doorkeeper.jp/events?q=${encodeURIComponent(query)}&locale=ja&page=${page}`;
      const rows = await fetchJson(url);
      if (!Array.isArray(rows) || !rows.length) break;
      found.push(...rows.map((row) => row.event).filter(Boolean));
      if (rows.length < 20) break;
      await sleep(700);
    }
  }
  const seen = new Set();
  return found
    .filter((event) => {
      const text = `${event.title || ""} ${decodeHtml(event.description || "").slice(0, 240)}`;
      const key = canonUrl(event.public_url || "");
      if (!key || seen.has(key) || isNoise(event.title) || !isCompetitionLike(text)) return false;
      seen.add(key);
      return true;
    })
    .map((event) => {
      const host = (() => {
        try {
          return new URL(event.public_url).hostname.replace(/\.doorkeeper\.jp$/, "");
        } catch {
          return "";
        }
      })();
      return {
        ...normalize({
          title: event.title,
          organizer: host,
          summary: decodeHtml(event.description || "").slice(0, 500),
          url: event.public_url,
          venue: [event.venue_name, event.address].filter(Boolean).join(" "),
          starts: isoDate(event.starts_at),
          deadline: isoDate(event.starts_at),
          category: inferCategory(`${event.title} ${decodeHtml(event.description || "").slice(0, 180)}`),
        }),
        origin: "doorkeeper",
      };
    });
}

async function readCatalog() {
  try {
    const raw = JSON.parse(await readFile(catalogPath, "utf8"));
    return {
      updatedAt: raw.updatedAt || "",
      competitions: Array.isArray(raw.competitions) ? raw.competitions : [],
    };
  } catch {
    return { updatedAt: "", competitions: [] };
  }
}

function merge(previous, incoming) {
  const byUrl = new Map();
  const byTitle = new Map();
  let nextId = 0;

  const remember = (item) => {
    nextId = Math.max(nextId, Number(item.id) || 0);
    const urlKey = canonUrl(item.url);
    if (urlKey) byUrl.set(urlKey, item);
    const nameKey = titleKey(item.title);
    if (nameKey) byTitle.set(nameKey, item);
  };

  const place = (item, keepId) => {
    if (!item.title || !item.url) return;
    const urlKey = canonUrl(item.url);
    const nameKey = titleKey(item.title);
    const current = byUrl.get(urlKey) || byTitle.get(nameKey);
    if (!current) {
      const id = keepId && item.id ? Number(item.id) : Math.max(nextId, 1_000_000) + 1;
      remember({ ...item, id });
      return;
    }
    const candidate = { ...item, id: current.id };
    const winner = richness(candidate) >= richness(current) ? { ...candidate } : { ...current };
    if (!winner.eligibility) winner.eligibility = candidate.eligibility || current.eligibility || "";
    if (!winner.eligibility) delete winner.eligibility;
    remember(winner);
  };

  for (const item of previous) place(item, true);
  for (const item of incoming) place(item, item.origin === "nuestar" && !byUrl.has(canonUrl(item.url)) && !byTitle.has(titleKey(item.title)));

  const unique = new Map();
  for (const item of byUrl.values()) unique.set(item.id, item);
  return [...unique.values()].sort(
    (a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999") || a.title.localeCompare(b.title, "ja"),
  );
}

async function withLock(task) {
  await mkdir(path.dirname(lockPath), { recursive: true });
  try {
    await writeFile(lockPath, String(Date.now()), { flag: "wx" });
  } catch {
    const stamp = Number(await readFile(lockPath, "utf8").catch(() => "0"));
    if (Date.now() - stamp < 30 * 60 * 1000) {
      console.log("別の更新が進行中のため、今回は見送りました");
      return readCatalog();
    }
    await writeFile(lockPath, String(Date.now()));
  }
  try {
    return await task();
  } finally {
    await rm(lockPath, { force: true });
  }
}

export async function runUpdate(options = {}) {
  const oncePerDay = options.oncePerDay ?? oncePerDayFlag;
  const previous = await readCatalog();
  if (oncePerDay && previous.updatedAt && tokyoDay(previous.updatedAt) === tokyoDay(Date.now())) {
    console.log("本日分は取得済みです");
    return previous;
  }
  return withLock(() => fetchAndSave(previous));
}

async function fetchAndSave(previous) {

  const jobs = [
    ["nuestar", "NueStarシート", fetchNuestar],
    ["jdn", "JDN登竜門", fetchJdn],
    ["hackathon-japan", "Hackathon Japan", fetchHackathonJapan],
    ["techplay", "TECH PLAY", fetchTechplay],
    ["gaxi", "ガクシー", fetchGaxi],
    ["doorkeeper", "Doorkeeper", fetchDoorkeeper],
    ["connpass", "connpass", fetchConnpass],
  ];
  const sources = [];
  const incoming = [];
  for (const [id, label, load] of jobs) {
    try {
      const rows = await load();
      incoming.push(...rows);
      sources.push({ id, label, ok: true, fetched: rows.length });
      console.log(`${label}: ${rows.length}件`);
    } catch (error) {
      sources.push({ id, label, ok: false, fetched: 0, error: error instanceof Error ? error.message : String(error) });
      console.error(`${label}の取得に失敗:`, error instanceof Error ? error.message : error);
    }
  }
  if (!sources.some((source) => source.ok)) {
    throw new Error("どのサイトからも取得できませんでした");
  }

  const kept = previous.competitions.filter((item) => item.origin === "nuestar" || !isNoise(item.title));
  const competitions = merge(kept, incoming);
  const catalog = {
    updatedAt: new Date().toISOString(),
    sources,
    competitions,
  };
  await mkdir(path.dirname(catalogPath), { recursive: true });
  const temporary = `${catalogPath}.tmp`;
  await writeFile(temporary, JSON.stringify(catalog));
  await rename(temporary, catalogPath);
  console.log(`保存 ${competitions.length}件 -> ${catalogPath}`);
  return catalog;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runUpdate().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
