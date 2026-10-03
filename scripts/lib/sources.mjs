import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Hashids from "hashids";
import { clipEligibility, decodeHtml, inferCategory, isCompetitionLike, normalize, scholarshipGenre } from "./normalize.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const jdnCachePath = path.join(root, "data", "jdn-links.json");
const UA = "challenge-zukan/1.0 (daily public-event catalog)";

const JDN_CATEGORIES = [
  "idea",
  "digital-media",
  "product",
  "space",
  "graphic",
  "entertainment",
  "literature",
  "senryu",
  "art",
  "photo",
  "character",
  "comic",
  "movie",
  "craft",
  "student",
];

const JDN_GENRE = {
  idea: "ビジネス・企画",
  "digital-media": "デジタル",
  product: "プロダクト",
  space: "建築・空間",
  graphic: "グラフィック",
  entertainment: "音楽・エンタメ",
  literature: "文芸・論文",
  senryu: "川柳・短歌",
  art: "絵画",
  photo: "写真",
  character: "ロゴ・キャラ",
  comic: "イラスト",
  movie: "映像",
  craft: "工芸・ファッション",
};

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

function isoDate(value) {
  if (!value) return "";
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function isForChildren(title) {
  if (/大学生|大学院|社会人|一般/.test(title)) return false;
  if (/高校生/.test(title) && !/小学生|幼児|園児/.test(title)) return false;
  return /小学生|中学生|幼児|園児|未就学|幼稚園|保育園|キッズ|幼・小|こども|子ども/.test(title);
}

const SCHOLARSHIP_GENRES = new Set(["学業", "留学", "スポーツ", "芸術", "医療・福祉", "理工", "経済支援"]);

function jdnCategory(slug, title, summary) {
  const guessed = inferCategory(`${title}\n${summary || ""}`);
  if (SCHOLARSHIP_GENRES.has(guessed) || guessed === "ハッカソン") return guessed;
  const titled = inferCategory(String(title || ""));
  if (!["", "その他", "ビジネス・企画", "交流会", "ハッカソン", ...SCHOLARSHIP_GENRES].includes(titled)) return titled;
  if (slug === "student") return guessed === "その他" ? "ビジネス・企画" : guessed;
  return JDN_GENRE[slug] || guessed;
}

function parseJdnList(html) {
  return html
    .split('<li class="contest-list-item">')
    .slice(1)
    .map((part) => {
      const url = part.match(/href="(https:\/\/compe\.japandesign\.ne\.jp\/[^"]+\/)"/)?.[1] || "";
      const title = decodeHtml(part.match(/<h3>([\s\S]*?)<\/h3>/)?.[1] || "");
      const comment = decodeHtml(part.match(/<dd class="table-cell">([\s\S]*?)<\/dd>/)?.[1] || "");
      const prize = decodeHtml(part.match(/<dt>賞<\/dt>\s*<dd>([\s\S]*?)<\/dd>/)?.[1] || "");
      const organizer = decodeHtml(part.match(/<dt>主催<\/dt>[\s\S]*?<dd>([\s\S]*?)<\/dd>/)?.[1] || "");
      const deadline = decodeHtml(part.match(/<dt>締切<\/dt>[\s\S]*?<dd>([\s\S]*?)<\/dd>/)?.[1] || "");
      const image = part.match(/<img[^>]+src="(https:\/\/compe\.japandesign\.ne\.jp\/[^"]+)"/)?.[1] || "";
      return { url, title, comment, prize, organizer, deadline, image };
    })
    .filter((item) => item.url && item.title && !isForChildren(item.title));
}

async function readJdnCache() {
  try {
    const parsed = JSON.parse(await readFile(jdnCachePath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function officialLink(html) {
  return html.match(/<a href="(https?:\/\/[^"]+)"[^>]*class="btn-koushiki"/)?.[1] || "";
}

export async function fetchJdn() {
  const found = [];
  for (const slug of JDN_CATEGORIES) {
    let page = 1;
    let maxPage = 1;
    while (page <= maxPage && page <= 8) {
      const url =
        page === 1
          ? `https://compe.japandesign.ne.jp/category/${slug}/`
          : `https://compe.japandesign.ne.jp/category/${slug}/page/${page}/`;
      const html = await fetchText(url);
      found.push(...parseJdnList(html).map((item) => ({ ...item, slug })));
      const nums = [...html.matchAll(/\/page\/(\d+)\//g)].map((match) => Number(match[1]));
      maxPage = Math.max(maxPage, ...nums, 1);
      page += 1;
      await sleep(250);
    }
  }

  const rank = {
    photo: 14,
    art: 13,
    comic: 12,
    character: 11,
    movie: 10,
    graphic: 9,
    craft: 8,
    product: 7,
    space: 6,
    literature: 5,
    senryu: 5,
    entertainment: 4,
    "digital-media": 3,
    idea: 2,
    student: 1,
  };
  const unique = new Map();
  for (const item of found) {
    const current = unique.get(item.url);
    if (!current || (rank[item.slug] || 0) > (rank[current.slug] || 0)) unique.set(item.url, item);
  }
  const cache = await readJdnCache();
  let fetchedDetails = 0;
  const rows = [];
  for (const item of unique.values()) {
    let official = cache[item.url] || "";
    if (!official) {
      try {
        official = officialLink(await fetchText(item.url)) || item.url;
        cache[item.url] = official;
        fetchedDetails += 1;
        if (fetchedDetails % 20 === 0) {
          await mkdir(path.dirname(jdnCachePath), { recursive: true });
          await writeFile(jdnCachePath, JSON.stringify(cache));
        }
        await sleep(200);
      } catch (error) {
        console.error(`登竜門の詳細を飛ばしました: ${item.title}`, error instanceof Error ? error.message : error);
        official = item.url;
      }
    }
    rows.push({
      ...normalize({
        title: item.title,
        organizer: item.organizer,
        summary: item.comment || `${item.organizer}が募集するコンテスト。`,
        url: official,
        image: item.image,
        prize: item.prize,
        deadlineText: item.deadline,
        category: jdnCategory(item.slug, item.title, item.comment),
        venue: "",
      }),
      origin: "jdn",
    });
  }
  if (fetchedDetails) {
    await mkdir(path.dirname(jdnCachePath), { recursive: true });
    await writeFile(jdnCachePath, JSON.stringify(cache));
  }
  console.log(`登竜門の公式リンクを${fetchedDetails}件確認`);
  return rows.filter((item) => item.title && item.url);
}

export async function fetchHackathonJapan() {
  const html = await fetchText("https://japanhackathons.com/");
  const data = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const list = data["@graph"].find((item) => item["@type"] === "ItemList");
  const urls = (list?.itemListElement || []).map((item) => item.url).filter(Boolean);
  const rows = [];
  for (const url of urls) {
    await sleep(250);
    const page = await fetchText(url);
    const eventData = JSON.parse(page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    const event = eventData["@graph"].find((item) => item["@type"] === "Event");
    if (!event?.name) continue;
    const register = event.offers?.[0]?.url || event.organizer?.url || url;
    const place = [event.location?.name, event.location?.address?.addressLocality].filter(Boolean).join(" ");
    const image = typeof event.image === "string" && !event.image.includes("/images/og/") ? event.image : "";
    rows.push({
      ...normalize({
        title: event.name,
        organizer: event.organizer?.name || "Hackathon Japan",
        summary: event.description || "",
        url: register,
        image,
        venue: place,
        starts: isoDate(event.startDate),
        deadline: isoDate(event.startDate),
        category: "ハッカソン",
      }),
      origin: "hackathon-japan",
    });
  }
  return rows.filter((item) => item.title && item.url);
}

function parseTechplay(html) {
  return [...html.matchAll(/<h3 class="text-lg font-bold break-all">([^<]+)<\/h3>/g)].map((match) => {
    const before = html.slice(Math.max(0, match.index - 3000), match.index);
    const after = html.slice(match.index, match.index + 2500);
    const href = [...before.matchAll(/href="(\/event\/\d+)"/g)].at(-1)?.[1] || "";
    const dates = [...before.matchAll(/(\d{4})\/(\d{2})\/(\d{2})/g)].map((item) => `${item[1]}-${item[2]}-${item[3]}`);
    const image = [...before.matchAll(/src="(https:\/\/s3\.techplay\.jp[^"]+)"/g)].at(-1)?.[1] || "";
    const venue = decodeHtml(after.match(/会場<\/span><span class="font-bold">([^<]+)/)?.[1] || "");
    return {
      title: decodeHtml(match[1]),
      url: href ? `https://techplay.jp${href}` : "",
      starts: dates[0] || "",
      image,
      venue,
    };
  });
}

const gaxiIds = new Hashids("himitsu_no_kagi", 16);

function tokyoToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function yenText(amount) {
  const n = Number(amount) || 0;
  if (n <= 0) return "";
  if (n >= 10_000) {
    const man = n / 10_000;
    const text = man >= 100 ? String(Math.round(man)) : String(Math.round(man * 10) / 10).replace(/\.0$/, "");
    return `${text}万円`;
  }
  return `${n}円`;
}

function scholarshipDeadline(row) {
  const year = Number(row.application_end_year);
  const month = Number(row.application_end_month);
  if (!year || !month) return "";
  const fallback = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Number(row.application_end_day) || fallback;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : "";
}

async function searchGaxi(form, page, limit = 50) {
  const response = await fetch("https://gaxi.jp/api/project/search", {
    method: "POST",
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-HTTP-Method-Override": "GET",
    },
    body: JSON.stringify({
      form: {
        scholarship_types: ["奨学金"],
        exists_school_recruitment_type: false,
        ...form,
      },
      limit,
      page,
      sort: "updated_at",
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error(`${response.status} gaxi`);
  const data = await response.json();
  return Array.isArray(data) ? data.filter((row) => row && typeof row === "object" && row.id && row.name) : [];
}

function isEstablishedScholarship(name, organizer) {
  if (/学生社員|アルバイト|説明会|インターン/.test(name || "")) return false;
  return /財団|育英会|奨学会|学生支援機構/.test(`${name} ${organizer}`);
}

function rememberGaxi(rows, seen, row, benefitFallback) {
  if (seen.has(row.id) || isForChildren(row.name)) return;
  const deadline = scholarshipDeadline(row);
  const season = `${tokyoToday().slice(0, 4)}-01-01`;
  if (!deadline || deadline < season) return;
  const program = row.program || {};
  const organizer = program.organization?.name || "";
  if (!isEstablishedScholarship(row.name, organizer)) return;
  seen.add(row.id);
  const benefit = String(program.benefit_type || benefitFallback);
  const kind = benefit.startsWith("貸与") ? "貸与" : "給付";
  const area = program.area_restriction && program.area_restriction !== "地域の制限なし" ? program.area_restriction : "";
  const amount = yenText(row.total_amount);
  rows.push({
    ...normalize({
      title: row.name,
      organizer,
      summary: `${organizer || "団体"}の${kind}型奨学金。${area ? `${area}が対象。` : "応募条件は公式ページで確認。"}`,
      url: `https://gaxi.jp/project/${gaxiIds.encode(row.id)}/`,
      prize: amount ? `${kind} 総額${amount}` : kind,
      prizeAmount: Number(row.total_amount) || 0,
      deadline,
      category: scholarshipGenre(`${row.name}\n${row.target || ""}`),
      target: "大学生 奨学金",
    }),
    origin: "gaxi",
    gaxiId: row.id,
  });
}

export async function fetchGaxi() {
  const seen = new Set();
  const rows = [];
  const queries = [["給付"], ["貸与（有利子）", "貸与（無利子）"]];
  for (const benefitTypes of queries) {
    for (let page = 1; page <= 5; page += 1) {
      const batch = await searchGaxi({ benefit_types: benefitTypes }, page);
      if (!batch.length) break;
      for (const row of batch) rememberGaxi(rows, seen, row, benefitTypes[0]);
      await sleep(200);
    }
  }
  for (const keyword of ["丸和", "あしなが", "笹川", "経団連", "キーエンス", "戸部", "竹中育英", "似鳥", "服部国際", "本庄", "岩谷"]) {
    const batch = await searchGaxi({ keyword }, 1, 20);
    for (const row of batch) rememberGaxi(rows, seen, row, "給付");
    await sleep(200);
  }
  if (!rows.some((row) => row.url.includes("maruwa-ikushi.org"))) {
    rows.push({
      ...normalize({
        title: "2026年度 自己開発チャレンジ奨学金",
        organizer: "公益財団法人 丸和育志会",
        summary: "公益財団法人丸和育志会の給付型奨学金。指定大学を通じて応募する。",
        url: "https://maruwa-ikushi.org/scholarship/recruitment-requirements/",
        prize: "給付 50万円",
        prizeAmount: 500_000,
        deadline: "2026-07-31",
        category: scholarshipGenre("2026年度 自己開発チャレンジ奨学金\n指定大学・大学院前期課程の学生。日本国籍。在学中に自己開発計画を実施し、報告できること。"),
        eligibility: "指定大学・大学院前期課程の学生。日本国籍。在学中に自己開発計画を実施し、報告できること。",
        target: "大学生 奨学金",
      }),
      origin: "direct",
    });
  }
  for (const row of rows) {
    if (!row.gaxiId) continue;
    try {
      const response = await fetch(`https://gaxi.jp/api/project/${row.gaxiId}`, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(45000),
      });
      if (response.ok) {
        const detail = await response.json();
        const eligibility = gaxiEligibility(detail);
        if (eligibility) row.eligibility = eligibility;
      }
    } catch {
      // 資格が取れなくても一覧自体は残す
    }
    delete row.gaxiId;
    await sleep(120);
  }
  return rows.filter((item) => item.title && item.url);
}

function gaxiEligibility(detail) {
  const lines = String(detail.application_condition || "")
    .split(/\n+/)
    .map((line) => line.replace(/^[\s・※●\-*]+/, "").replace(/\s+/g, " ").trim())
    .filter((line) => line && !/^以下の/.test(line));
  const extra = [];
  if (detail.major_detail && !/制限なし/.test(detail.major_detail)) extra.push(detail.major_detail);
  if (detail.area_restriction && detail.area_restriction !== "地域の制限なし") extra.push(`地域は${detail.area_restriction}`);
  const text = [...lines.slice(0, 3), ...extra.filter((item) => !lines.join("").includes(item))].join("。");
  return clipEligibility(text);
}

export async function fetchTechplay() {
  const found = [];
  for (const tag of ["hackathon", "contest"]) {
    const html = await fetchText(`https://techplay.jp/event/tag/${tag}`);
    found.push(...parseTechplay(html));
    await sleep(300);
  }
  const seen = new Set();
  return found
    .filter((item) => {
      if (!item.url || !item.title || seen.has(item.url) || !isCompetitionLike(item.title)) return false;
      seen.add(item.url);
      return true;
    })
    .map((item) => ({
      ...normalize({
        title: item.title,
        organizer: "",
        summary: item.venue || item.title,
        url: item.url,
        image: item.image,
        venue: item.venue,
        starts: item.starts,
        deadline: item.starts,
        category: inferCategory(item.title),
      }),
      origin: "techplay",
    }));
}

function plain(value) {
  return decodeHtml(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function pageLines(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<[^>]+>/g, "\n")
    .split("\n")
    .map((line) => plain(line).replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function isOffCatalog(title) {
  const name = title || "";
  if (/コンテスト|コンペ|コンクール|アワード|ハッカソン|論文|作文|川柳|俳句|短歌|ポスター|イラスト|写真|デザイン/.test(name)) return false;
  return /名称募集|愛称募集|名前を募集|ネーミング|お名前|キャンペーン|モニター募集|プレゼント/.test(name);
}

function parseKoubo(html) {
  const pattern = /href="(\/contest\/\d+)"><h3[^>]*>(.*?)<\/h3><p[^>]*>(.*?)<\/p>/gs;
  return [...html.matchAll(pattern)].map((match) => {
    const window = html.slice(match.index, match.index + 3500);
    const full = window.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    const short = window.match(/(\d{1,2})\/(\d{1,2})\s*締切/);
    let deadline = "";
    if (full) deadline = `${full[1]}年${full[2]}月${full[3]}日`;
    else if (short) {
      const month = Number(short[1]);
      const day = Number(short[2]);
      let year = Number(tokyoToday().slice(0, 4));
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (iso < tokyoToday()) year += 1;
      deadline = `${year}年${month}月${day}日`;
    }
    const image = window.match(/src="(https:\/\/[^"]+)"/)?.[1]?.split("?")[0] || "";
    return {
      url: `https://koubo.jp${match[1]}`,
      title: plain(match[2]),
      summary: plain(match[3]),
      deadline,
      image,
    };
  });
}

export async function fetchKoubo() {
  const seen = new Set();
  const rows = [];
  for (let category = 1; category <= 13; category += 1) {
    for (let page = 1; page <= 5; page += 1) {
      const html = await fetchText(`https://koubo.jp/contest/list?c=${category}&p=${page}`);
      const batch = parseKoubo(html).filter((item) => item.title && !seen.has(item.url));
      if (!batch.length) break;
      for (const item of batch) {
        seen.add(item.url);
        if (isForChildren(item.title) || isOffCatalog(item.title)) continue;
        let categoryName = inferCategory(`${item.title}\n${item.summary}`);
        if (categoryName === "その他" && /文学|小説|詩|エッセイ|作文|脚本|川柳|俳句|短歌/.test(item.title)) categoryName = "文芸・論文";
        rows.push({
          ...normalize({
            title: item.title,
            organizer: "",
            summary: item.summary || item.title,
            url: item.url,
            image: item.image,
            deadlineText: item.deadline,
            category: categoryName,
          }),
          origin: "koubo",
        });
      }
      await sleep(200);
    }
  }
  return rows.filter((item) => item.title && item.url);
}

function compediaOfficial(html) {
  const links = [...html.matchAll(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  for (const match of links) {
    const label = plain(match[2]);
    const url = match[1];
    if (!/公式/.test(label)) continue;
    if (/compedia\.jp|twitter\.com|x\.com|facebook\.com|instagram\.com/.test(url)) continue;
    return url;
  }
  return "";
}

export async function fetchCompedia() {
  const posts = [];
  for (let page = 1; page <= 3; page += 1) {
    const batch = await fetchJson(`https://compedia.jp/wp-json/wp/v2/posts?per_page=20&page=${page}&_fields=link,title`);
    if (!Array.isArray(batch) || !batch.length) break;
    posts.push(...batch);
    await sleep(200);
  }
  const rows = [];
  for (const post of posts) {
    if (rows.length >= 40) break;
    const title = plain(post?.title?.rendered || "");
    const link = post?.link || "";
    if (!title || !link || /結果発表|受賞者|入賞者/.test(title) || isForChildren(title)) continue;
    await sleep(180);
    let html = "";
    try {
      html = await fetchText(link);
    } catch {
      continue;
    }
    const lines = pageLines(html);
    const organizerAt = lines.indexOf("主催");
    const organizer = organizerAt >= 0 ? lines[organizerAt + 1] || "" : "";
    const deadlineAt = lines.findIndex((line) => line === "応募締め切り" || line === "応募締切" || line === "募集締切");
    const deadline = lines.find((line) => /応募締め切り|応募締切|募集締切/.test(line) && /\d/.test(line))
      || (deadlineAt >= 0 ? lines[deadlineAt + 1] || "" : "");
    const prizeLine = lines.find((line) => /賞金|賞品|グランプリ|最優秀/.test(line) && /\d/.test(line)) || "";
    const summary = lines.filter((line) => line.length > 40 && !/sourceURL|function\(/.test(line)).slice(0, 2).join(" ");
    rows.push({
      ...normalize({
        title,
        organizer: organizer && organizer.length < 80 ? organizer : "",
        summary: summary || title,
        url: compediaOfficial(html) || link,
        deadlineText: deadline,
        prize: prizeLine,
        category: inferCategory(`${title}\n${summary}`),
      }),
      origin: "compedia",
    });
  }
  return rows.filter((item) => item.title && item.url);
}

const ENGLISH_MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function englishRange(text) {
  const year = Number(String(text || "").match(/20\d{2}/)?.[0] || 0);
  if (!year) return { start: "", end: "" };
  const parts = [...String(text).matchAll(/([A-Za-z]{3,9})\.?\s+(\d{1,2})/g)];
  const toIso = (part, usedYear) => {
    const month = ENGLISH_MONTHS[part[1].slice(0, 3).toLowerCase()];
    if (!month) return "";
    return `${usedYear}-${String(month).padStart(2, "0")}-${String(part[2]).padStart(2, "0")}`;
  };
  if (!parts.length) return { start: "", end: "" };
  let startYear = year;
  const endMonth = ENGLISH_MONTHS[parts.at(-1)[1].slice(0, 3).toLowerCase()] || 0;
  const startMonth = ENGLISH_MONTHS[parts[0][1].slice(0, 3).toLowerCase()] || 0;
  if (parts.length > 1 && startMonth > endMonth) startYear -= 1;
  return { start: toIso(parts[0], startYear), end: toIso(parts.at(-1), year) };
}

export async function fetchDevpost() {
  const rows = [];
  const seen = new Set();
  for (let page = 1; page <= 22; page += 1) {
    const data = await fetchJson(`https://devpost.com/api/hackathons?status[]=upcoming&status[]=open&page=${page}`);
    const batch = Array.isArray(data?.hackathons) ? data.hackathons : [];
    if (!batch.length) break;
    for (const item of batch) {
      if (!item?.title || !item?.url || item.invite_only || seen.has(item.url)) continue;
      seen.add(item.url);
      const dates = englishRange(item.submission_period_dates || "");
      const place = item.displayed_location?.location || "";
      const venue = /online/i.test(place) ? "オンライン" : place.replace(/Tokyo/gi, "東京");
      const prize = plain(item.prize_amount || "");
      rows.push({
        ...normalize({
          title: item.title,
          organizer: item.organization_name || "",
          summary: `${item.organization_name || "主催者"}のハッカソン。${item.submission_period_dates || ""}`.trim(),
          url: item.url,
          image: item.thumbnail_url ? `https:${String(item.thumbnail_url).replace(/^https?:/, "")}` : "",
          venue,
          starts: dates.start,
          deadline: dates.end,
          prize,
          category: "ハッカソン",
        }),
        origin: "devpost",
      });
    }
    if (batch.length < (data?.meta?.per_page || 9)) break;
    await sleep(250);
  }
  return rows.filter((item) => item.title && item.url);
}

function nextAnnualDate(text) {
  const explicit = text.match(/(20\d{2})年(\d{1,2})月(\d{1,2})日/);
  if (explicit) return `${explicit[1]}-${String(explicit[2]).padStart(2, "0")}-${String(explicit[3]).padStart(2, "0")}`;
  const rough = text.match(/(\d{1,2})月(上旬|中旬|下旬|\d{1,2}日)/);
  if (!rough) return "";
  const month = Number(rough[1]);
  const day = rough[2] === "上旬" ? 5 : rough[2] === "中旬" ? 15 : rough[2] === "下旬" ? 25 : Number(rough[2]);
  let year = Number(tokyoToday().slice(0, 4));
  let iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (iso < tokyoToday()) {
    year += 1;
    iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return iso;
}

function washimaruOfficial(html) {
  const links = [...html.matchAll(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  for (const match of links) {
    if (!/公式/.test(plain(match[2]))) continue;
    if (/washimaru-univ\.com|twitter\.com|x\.com|facebook\.com/.test(match[1])) continue;
    return match[1];
  }
  return "";
}

export async function fetchWashimaru() {
  const rows = [];
  const seen = new Set();
  for (let page = 1; page <= 16; page += 1) {
    let posts = [];
    try {
      posts = await fetchJson(
        `https://washimaru-univ.com/wp-json/wp/v2/posts?categories=124&per_page=20&page=${page}&_fields=link,title,content`,
      );
    } catch {
      break;
    }
    if (!Array.isArray(posts) || !posts.length) break;
    for (const post of posts) {
      const title = plain(post?.title?.rendered || "").replace(/^【[^】]+】/, "").trim();
      const html = post?.content?.rendered || "";
      if (!title || seen.has(title) || !/奨学金/.test(title) || isForChildren(title)) continue;
      seen.add(title);
      const lines = pageLines(html);
      const requirement = lines.slice(lines.findIndex((line) => line.includes("募集要件")));
      const field = (label) => requirement.find((line) => line.startsWith(label))?.split("：").slice(1).join("：").trim() || "";
      const amount = field("受給月額") || field("給付額") || field("貸与額");
      const deadlineText = field("締め切り") || field("締切");
      const eligibility = [field("応募可能学年"), field("学部制限"), field("地域制限"), field("所得制限")]
        .filter((line) => line && line !== "無")
        .join("。");
      const organizer = title.replace(/(給付型|貸与型)?奨学金$/, "").trim();
      rows.push({
        ...normalize({
          title,
          organizer,
          summary: [amount && `給付月額${amount}`, field("採用人数") && `採用${field("採用人数")}`, deadlineText && `締切の目安は${deadlineText}`]
            .filter(Boolean)
            .join("。") || `${organizer}の給付型奨学金。`,
          url: washimaruOfficial(html) || post.link,
          prize: amount ? `給付 月額${amount}` : "給付",
          deadline: nextAnnualDate(deadlineText),
          deadlineText,
          eligibility,
          target: "大学生 奨学金",
          category: scholarshipGenre(`${title}\n${eligibility}`),
        }),
        origin: "washimaru",
      });
    }
    await sleep(200);
  }
  return rows.filter((item) => item.title && item.url);
}
