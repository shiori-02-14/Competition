const PREFS = {
  北海道: "北海道・東北",
  青森: "北海道・東北",
  岩手: "北海道・東北",
  宮城: "北海道・東北",
  秋田: "北海道・東北",
  山形: "北海道・東北",
  福島: "北海道・東北",
  茨城: "関東",
  栃木: "関東",
  群馬: "関東",
  埼玉: "関東",
  千葉: "関東",
  東京: "関東",
  神奈川: "関東",
  新潟: "中部・北陸",
  富山: "中部・北陸",
  石川: "中部・北陸",
  福井: "中部・北陸",
  山梨: "中部・北陸",
  長野: "中部・北陸",
  岐阜: "中部・北陸",
  静岡: "中部・北陸",
  愛知: "中部・北陸",
  三重: "中部・北陸",
  滋賀: "関西",
  京都: "関西",
  大阪: "関西",
  兵庫: "関西",
  奈良: "関西",
  和歌山: "関西",
  鳥取: "中国・四国",
  島根: "中国・四国",
  岡山: "中国・四国",
  広島: "中国・四国",
  山口: "中国・四国",
  徳島: "中国・四国",
  香川: "中国・四国",
  愛媛: "中国・四国",
  高知: "中国・四国",
  福岡: "九州・沖縄",
  佐賀: "九州・沖縄",
  長崎: "九州・沖縄",
  熊本: "九州・沖縄",
  大分: "九州・沖縄",
  宮崎: "九州・沖縄",
  鹿児島: "九州・沖縄",
  沖縄: "九州・沖縄",
};

const ALIASES = [
  ["サンフランシスコ", "海外:サンフランシスコ"],
  ["シリコンバレー", "海外:シリコンバレー"],
  ["San Francisco", "海外:サンフランシスコ"],
  ["Silicon Valley", "海外:シリコンバレー"],
  ["シンガポール", "海外:シンガポール"],
  ["アメリカ", "海外:アメリカ"],
  ["米国", "海外:アメリカ"],
  ["東京都", "東京"],
  ["都内", "東京"],
  ["名古屋", "愛知"],
  ["豊橋", "愛知"],
  ["豊田", "愛知"],
  ["浜松", "静岡"],
  ["金沢", "石川"],
  ["横浜", "神奈川"],
  ["鎌倉", "神奈川"],
  ["渋谷", "東京"],
  ["新宿", "東京"],
  ["虎ノ門", "東京"],
  ["六本木", "東京"],
  ["銀座", "東京"],
  ["梅田", "大阪"],
  ["難波", "大阪"],
  ["博多", "福岡"],
  ["札幌", "北海道"],
  ["仙台", "宮城"],
  ["神戸", "兵庫"],
  ["那覇", "沖縄"],
  ...Object.keys(PREFS).map((name) => [name, name]),
].sort((a, b) => b[0].length - a[0].length);

const TAGS = [
  ["AI", /AI|人工知能|LLM|生成AI|機械学習|エージェント/i],
  ["開発", /開発|エンジニア|プログラミング|アプリ|実装|ソフトウェア/],
  ["起業", /起業|スタートアップ|ビジネスプラン|ピッチ|事業化|アントレ/],
  ["デザイン", /デザイン|UI|UX|プロダクトデザイン/],
  ["研究", /研究|学術|論文|奨学金|博士|大学院|研究者/],
  ["社会課題", /社会課題|地域課題|ソーシャル|SDGs|サステナ|脱炭素/],
  ["セキュリティ", /セキュリティ|CTF|サイバー/],
  ["ゲーム", /ゲーム/],
  ["地域", /地域|地方創生|まちづくり|地元/],
  ["アート", /アート|芸術|映画|写真|クリエイ/],
  ["医療", /医療|介護|ヘルスケア|健康|ケア/],
  ["海外", /海外|グローバル|渡航|留学|シリコンバレー|San Francisco/i],
];

const TRACK = new Set(["fbclid", "gclid", "mc_eid", "mc_cid", "igshid", "mibextid"]);

export function cleanUrl(url) {
  try {
    const parsed = new URL(url);
    const kept = [...parsed.searchParams.entries()].filter(
      ([key]) => !key.toLowerCase().startsWith("utm_") && !TRACK.has(key.toLowerCase()),
    );
    parsed.search = "";
    for (const [key, value] of kept) parsed.searchParams.append(key, value);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

export function canonUrl(url) {
  try {
    const parsed = new URL(cleanUrl(url));
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    return host + parsed.pathname.replace(/\/+$/, "");
  } catch {
    return String(url || "").trim().toLowerCase();
  }
}

export function contestKey(title) {
  const text = String(title || "").normalize("NFKC");
  const edition = text.match(/第\s*(\d+)\s*回/)?.[1] || "";
  const base = text
    .replace(/《[^》]*》/g, "")
    .replace(/([A-Za-z0-9])[（(][ァ-ヶー\s]+[)）]/g, "$1")
    .replace(/第\s*\d+\s*回/g, "")
    .replace(/[ーｰ－−–—〜～]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
  return { base, edition };
}

export function titleKey(title) {
  const { base, edition } = contestKey(title);
  return edition ? `${base}#${edition}` : base;
}

export function decodeHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parsePrize(text) {
  if (!text) return { top: 0, pool: 0 };
  const src = text.replace(/[,，\s　]/g, "");
  const used = Array(src.length).fill(false);
  const found = [];
  const claim = (start, end, yen) => {
    if (yen <= 0 || used.slice(start, end).some(Boolean)) return;
    for (let i = start; i < end; i += 1) used[i] = true;
    found.push({ yen: Math.round(yen), pos: start });
  };
  for (const match of src.matchAll(/(\d+(?:\.\d+)?)万ドル/g)) {
    claim(match.index, match.index + match[0].length, Number(match[1]) * 10000 * 150);
  }
  for (const match of src.matchAll(/(\d+(?:\.\d+)?)億(?:(\d+(?:\.\d+)?)万)?円/g)) {
    claim(
      match.index,
      match.index + match[0].length,
      Number(match[1]) * 100_000_000 + (match[2] ? Number(match[2]) * 10_000 : 0),
    );
  }
  for (const match of src.matchAll(/(\d+(?:\.\d+)?)万円/g)) {
    claim(match.index, match.index + match[0].length, Number(match[1]) * 10_000);
  }
  for (const match of src.matchAll(/(\d+(?:\.\d+)?)千円/g)) {
    claim(match.index, match.index + match[0].length, Number(match[1]) * 1000);
  }
  for (const match of src.matchAll(/\$(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)(?:USD|USDC)/g)) {
    claim(match.index, match.index + match[0].length, Number(match[1] || match[2]) * 150);
  }
  for (const match of src.matchAll(/(\d+(?:\.\d+)?)ユーロ/g)) {
    claim(match.index, match.index + match[0].length, Number(match[1]) * 160);
  }
  for (const match of src.matchAll(/(\d{3,})円/g)) {
    claim(match.index, match.index + match[0].length, Number(match[1]));
  }
  const tops = [];
  const pools = [];
  const others = [];
  for (const item of found) {
    const window = src.slice(Math.max(0, item.pos - 24), item.pos);
    if (/交通費|旅費|宿泊/.test(window)) continue;
    if (/総額|懸賞金/.test(window) && !/1位|１位|最優秀|優勝|グランプリ|大賞/.test(window)) pools.push(item.yen);
    else if (/最優秀|優勝|グランプリ|大賞|1位|１位|最高/.test(window)) tops.push(item.yen);
    else others.push(item.yen);
  }
  let top = 0;
  if (tops.length) top = Math.max(...tops);
  else if (others.length) top = Math.max(...others);
  const pool = pools.length ? Math.max(...pools) : 0;
  return { top, pool: pool && top && pool < top ? top : pool };
}

function validDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return false;
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day && year >= 2000 && year <= 2035;
}

function pad(isoYear, month, day) {
  return `${String(isoYear).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function extractDates(text, year) {
  if (!text) return [];
  const used = Array(text.length).fill(false);
  const found = [];
  const claim = (start, end, iso) => {
    if (start < 0 || end > text.length || used.slice(start, end).some(Boolean) || !validDate(iso)) return;
    for (let i = start; i < end; i += 1) used[i] = true;
    found.push(iso);
  };
  const ten = { 上旬: 5, 中旬: 15, 下旬: 25 };
  for (const match of text.matchAll(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/g)) {
    claim(match.index, match.index + match[0].length, pad(match[1], match[2], match[3]));
  }
  for (const match of text.matchAll(/(20\d{2})年(\d{1,2})月(上旬|中旬|下旬)/g)) {
    claim(match.index, match.index + match[0].length, pad(match[1], match[2], ten[match[3]]));
  }
  for (const match of text.matchAll(/(?<!\d)(\d{1,2})月(\d{1,2})日/g)) {
    claim(match.index, match.index + match[0].length, pad(year, match[1], match[2]));
  }
  for (const match of text.matchAll(/(?<!\d)(\d{1,2})月(上旬|中旬|下旬)/g)) {
    claim(match.index, match.index + match[0].length, pad(year, match[1], ten[match[2]]));
  }
  return found;
}

function inferYear(title, summary, text) {
  const inText = String(text || "").match(/20\d{2}/);
  if (inText) return Number(inText[0]);
  const around = `${title} ${summary}`.match(/20\d{2}/);
  return around ? Number(around[0]) : new Date().getFullYear();
}

function pickDate(isoHint, text, title, summary, mode) {
  if (validDate(isoHint)) return isoHint;
  if (!text || ["-", "−", "null", "なし"].includes(text.trim())) return "";
  const dates = extractDates(text, inferYear(title, summary, text));
  if (!dates.length) return "";
  return mode === "max" ? dates.sort().at(-1) : dates.sort()[0];
}

function findPlace(text) {
  if (!text) return "";
  for (const [alias, target] of ALIASES) {
    if (alias && text.includes(alias)) return target;
  }
  return "";
}

function genreFromTitle(title) {
  const t = String(title || "");
  if (/写真|フォトコン|フォトコンテスト/.test(t)) return "写真";
  if (/映画|アニメ|映像|ショートフィルム|動画コンテスト/.test(t)) return "映像";
  if (/イラスト|illustration|マンガ|漫画|ぬりえ|塗り絵/i.test(t)) return "イラスト";
  if (/ロゴ|キャラクター|シンボルマーク|校章/.test(t)) return "ロゴ・キャラ";
  if (/ポスター|グラフィック/.test(t)) return "グラフィック";
  if (/建築|インテリア|エクステリア|空間デザイン|空間アワード/.test(t)) return "建築・空間";
  if (/プロダクト|家具|商品企画/.test(t)) return "プロダクト";
  if (/ファッション|工芸|アパレル|キルト/.test(t)) return "工芸・ファッション";
  if (/絵画|版画|美術展/.test(t)) return "絵画";
  if (/川柳|俳句|短歌/.test(t)) return "川柳・短歌";
  if (/音楽コンテスト|作曲|演奏|音楽録音|レシピコンテスト|お弁当コンテスト/.test(t)) return "音楽・エンタメ";
  if (/論文|エッセイ|小説|コピー|小論文|作文|脚本|手紙|標語|文学賞/.test(t)) return "文芸・論文";
  if (/ビジネス|起業|ピッチ|ビジコン|ビジネスプラン|スタートアップ|アクセラ/.test(t)) return "ビジネス・企画";
  if (/アプリ|プログラミング|ゲーム開発|Webサービス|ウェブサービス/.test(t)) return "デジタル";
  return "";
}

export function scholarshipGenre(text) {
  const raw = String(text || "").replace(/[^。\n]*を除く/g, "");
  const title = raw.split("\n")[0];
  const extra = raw.slice(title.length);
  if (/スポーツ/.test(raw)) return "スポーツ";
  if (/留学/.test(raw)) return "留学";
  if (/芸術|美術|音楽|デザイン|工芸/.test(title) || /芸術|美術|音楽|デザイン|工芸/.test(extra)) return "芸術";
  if (/ひとり親|児童養護|母子家庭|父子家庭|生活保護/.test(raw)) return "経済支援";
  if (/看護|医療|薬学|福祉|介護/.test(raw)) return "医療・福祉";
  if (/理工|工学|情報工学|情報系|理工学/.test(raw)) return "理工";
  return "学業";
}

export function inferCategory(text) {
  const t = String(text || "");
  const title = t.split("\n")[0];
  if (/奨学金|奨学会|奨学財団/.test(t) && !/コンテスト|コンペ|ハッカソン|ピッチ/.test(t)) return scholarshipGenre(t);
  if (/ハッカソン|hackathon|アイデアソン|\bHack\b|ハック(?!イング)/i.test(title)) return "ハッカソン";
  if (/交流会|ミートアップ|meetup/i.test(title)) return "交流会";
  const genre = genreFromTitle(title);
  if (genre) return genre;
  if (/研究助成/.test(t)) return "文芸・論文";
  if (/コンテスト|コンペ|アワード|グランプリ|ピッチ|ビジコン/.test(t)) return "ビジネス・企画";
  return "その他";
}

export function isCompetitionLike(text) {
  return /ハッカソン|アイデアソン|コンテスト|コンペ|ビジコン|ピッチ|アワード|グランプリ|アクセラ|奨学金|懸賞金|hackathon|contest/i.test(text);
}

export function normalize(raw) {
  const title = String(raw.title || "").trim();
  const organizer = String(raw.organizer || "").trim();
  const summary = decodeHtml(raw.summary || "").slice(0, 500);
  const prize = String(raw.prize || "").trim();
  let venue = String(raw.venue || "").trim();
  if (["-", "−", "null", "なし"].includes(venue)) venue = "";
  const blob = [title, organizer, summary, prize, venue, raw.target || ""].join("\n");
  let category = raw.category || inferCategory(blob);
  if (category === "不明" || category === "") category = "その他";

  const deadline = pickDate(raw.deadline, raw.deadlineText || "", title, summary, "max");
  const starts = pickDate(raw.starts, raw.startsText || "", title, summary, "min");
  const rolling = /随時|通年/.test(raw.deadlineText || "");
  const closedHint = /受付は終了|締め切りました|募集終了|新規エントリー受付は終了/.test(blob);

  const place = findPlace(venue) || findPlace(summary) || findPlace(title);
  let region = "";
  let area = "不明";
  if (place.startsWith("海外:")) {
    region = place.split(":")[1];
    area = "海外";
  } else if (PREFS[place]) {
    region = place;
    area = PREFS[place];
  } else if (/オンライン|online|Zoom/i.test(venue)) {
    region = "オンライン";
    area = "オンライン";
  }

  const hasOnline = /オンライン|online|Zoom/i.test(blob);
  const hybridWord = /ハイブリッド|併用|およびオンライン|／オンライン|とオンライン|オンライン \//.test(blob);
  let format = "unknown";
  if (hybridWord || (hasOnline && region && !["オンライン", "不明", "海外"].includes(area))) format = "hybrid";
  else if (hasOnline && ["オンライン", "不明"].includes(area)) format = "online";
  else if (region || venue) format = "onsite";
  if (area === "海外" && hasOnline && !hybridWord) format = "onsite";
  if (region === "オンライン") format = "online";

  let audience = "anyone";
  if (/高校生限定|中学生|小中高|U-18|18歳以下/.test(blob)) audience = "youth";
  else if (/学生限定|学生のみ|学生向け|学生対象|学生のための|学生が主体|学生起業/.test(blob)) audience = "student";
  else if (/大学院|研究者|博士/.test(blob) && !/学生向け|大学生/.test(blob)) audience = "researcher";
  else if (/社会人限定|創業者限定|スタートアップを対象/.test(blob) && !/学生/.test(blob)) audience = "founder";
  else if (/高校生|大学生|学生|高専/.test(blob)) audience = "student";
  else if (/若手|U-25|25歳以下|30歳まで/.test(blob)) audience = "youth";

  const forStudent = /学生|高校生|高専|大学生|大学院生/.test(blob);
  const isBuild = /ハッカソン|実装|プロトタイプ|試作品|ソースコード|開発して|作品を開発|アプリを開発/.test(blob);
  const isDoc = /書類選考|書類審査|企画書|アイデアを募集|アイデア段階|エントリーシート|小論文|400字|ビジネスプラン/.test(blob);
  let docOnly = category !== "ハッカソン" && isDoc && !isBuild;
  if (category === "ビジネス・企画" && /アイデア|ビジネスプラン|企画/.test(blob) && !isBuild) docOnly = true;
  const beginner = /初心者|未経験|初めての|はじめての|経験不問|知識がなくても|プログラミング経験不要|専門知識がなくても|気軽に参加/.test(blob);
  const tags = TAGS.filter(([, pattern]) => pattern.test(blob)).map(([name]) => name).slice(0, 6);
  const funding = /出資|資金調達|エクイティ|Investment|funding/i.test(blob);
  const parsed = parsePrize(prize);
  const travelSupport = /交通費|旅費|宿泊/.test(prize) && !/賞金|最優秀|優勝|グランプリ|大賞|優秀賞|入賞|開発支援/.test(prize);
  const amount = travelSupport ? 0 : Number(raw.prizeAmount) || 0;
  const topYen = travelSupport ? 0 : parsed.top || amount;
  const poolYen = travelSupport ? 0 : parsed.pool;

  let effort = 2;
  if (/\d\s*ヶ?月|か月|半年|合宿|渡航|アクセラレー/.test(blob)) effort = 4;
  else if (category === "交流会" || (/交流会|説明会|ミートアップ|Meetup|ワークショップ/.test(blob) && category !== "ハッカソン")) effort = 1;
  else if (category === "ハッカソン" || /ハッカソン/.test(blob)) effort = 3;
  else if (docOnly) effort = 2;

  const eligibility = clipEligibility(raw.eligibility || raw.target);

  return {
    id: raw.id,
    title,
    organizer,
    summary,
    url: cleanUrl(raw.url || ""),
    image: raw.image || "",
    category,
    deadline,
    starts,
    rolling,
    venue,
    prize,
    topYen,
    poolYen,
    funding,
    region,
    area,
    format,
    audience,
    forStudent,
    docOnly,
    beginner,
    tags,
    effort,
    closedHint,
    ...(eligibility ? { eligibility } : {}),
  };
}

export function clipEligibility(text) {
  const cleaned = String(text || "")
    .replace(/\s+/g, " ")
    .replace(/([^\x00-\x7F])\s+(?=[^\x00-\x7F])/g, "$1")
    .replace(/^[・※●\-\s]+/, "")
    .replace(/。+）/g, "）")
    .replace(/。{2,}/g, "。")
    .trim();
  if (!cleaned || ["-", "−", "なし", "無し", "記載なし", "null"].includes(cleaned)) return "";
  return cleaned.length > 140 ? `${cleaned.slice(0, 140)}…` : cleaned;
}

export function richness(item) {
  return (
    (item.origin === "nuestar" ? 8 : 0) +
    (item.deadline ? 4 : 0) +
    (item.prize ? 2 : 0) +
    (item.image ? 1 : 0) +
    Math.min(item.summary?.length || 0, 400) / 400
  );
}

const check = parsePrize("賞金総額1500万円（1位: 500万円、2位: 400万円）");
if (check.top !== 5_000_000 || check.pool !== 15_000_000) {
  throw new Error("賞金の読み取りに失敗しました");
}
const travel = parsePrize("交通費支援（最大10,000円）");
if (travel.top !== 0 || travel.pool !== 0) {
  throw new Error("交通費を賞金として読んでいます");
}
const gift = parsePrize("最優秀賞 1万円分の図書カード");
if (gift.top !== 10_000) throw new Error("図書カードの金額を読めていません");
const quo = parsePrize("一般賞 500円分のQUOカード");
if (quo.top !== 500) throw new Error("QUOカードの金額を読めていません");
const euro = parsePrize("賞 2000ユーロ相当の賞品");
if (euro.top !== 320_000) throw new Error("ユーロの金額を読めていません");
