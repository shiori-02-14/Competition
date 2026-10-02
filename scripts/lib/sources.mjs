import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decodeHtml, inferCategory, isCompetitionLike, normalize } from "./normalize.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const jdnCachePath = path.join(root, "data", "jdn-links.json");
const UA = "challenge-zukan/1.0 (daily public-event catalog)";

const JDN_CATEGORIES = ["idea", "digital-media", "product", "space", "graphic", "entertainment", "student"];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html" },
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
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

function jdnCategory(slug, title, summary) {
  const text = `${title} ${summary}`;
  if (/ハッカソン|アイデアソン|hackathon/i.test(text)) return "ハッカソン";
  if (/奨学金|研究助成/.test(text)) return "学術";
  if (slug === "idea" || /ビジネス|起業|ピッチ/.test(text)) return "ビジコン";
  if (slug === "student") return inferCategory(text);
  return "その他";
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

  const unique = new Map();
  for (const item of found) unique.set(item.url, item);
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
