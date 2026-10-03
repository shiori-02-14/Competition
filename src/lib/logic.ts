import { canonicalize, collapseVowels, norm, registerPhrases, squash, tokenHits } from "./kana";
import { PLACE_WORDS, SEARCH_PHRASES } from "./phrases";
import type {
  Audience,
  Category,
  Competition,
  Filters,
  Format,
  Profile,
  ProfileArea,
  Role,
  SortKey,
  StatusFilter,
} from "./types";

registerPhrases(SEARCH_PHRASES);

export const CONTEST_CATEGORIES: Category[] = [
  "ハッカソン",
  "ビジネス・企画",
  "デジタル",
  "グラフィック",
  "プロダクト",
  "建築・空間",
  "ロゴ・キャラ",
  "イラスト",
  "絵画",
  "写真",
  "映像",
  "川柳・短歌",
  "文芸・論文",
  "音楽・エンタメ",
  "工芸・ファッション",
  "交流会",
  "その他",
];

export const SCHOLARSHIP_CATEGORIES: Category[] = ["学業", "留学", "スポーツ", "芸術", "医療・福祉", "理工", "経済支援"];

export const CATEGORIES: Category[] = [...CONTEST_CATEGORIES, ...SCHOLARSHIP_CATEGORIES];

export function isScholarship(category: Category): boolean {
  return SCHOLARSHIP_CATEGORIES.includes(category);
}

export const CATEGORY_SHORT: Record<Category, string> = {
  ハッカソン: "HACK",
  "ビジネス・企画": "BIZ",
  デジタル: "WEB",
  グラフィック: "GRAPH",
  プロダクト: "PROD",
  "建築・空間": "SPACE",
  "ロゴ・キャラ": "LOGO",
  イラスト: "ILLUST",
  絵画: "PAINT",
  写真: "PHOTO",
  映像: "MOVIE",
  "川柳・短歌": "POEM",
  "文芸・論文": "LIT",
  "音楽・エンタメ": "ENT",
  "工芸・ファッション": "CRAFT",
  交流会: "MEET",
  その他: "ETC",
  学業: "STUDY",
  留学: "ABROAD",
  スポーツ: "SPORT",
  芸術: "ARTS",
  "医療・福祉": "CARE",
  理工: "STEM",
  経済支援: "AID",
};

const LEGACY_CATEGORY: Record<string, Category> = {
  ビジコン: "ビジネス・企画",
  学術: "文芸・論文",
  スタートアップ: "ビジネス・企画",
  アクセラレーション: "ビジネス・企画",
  奨学金: "学業",
};

export const TAGS = [
  "AI",
  "開発",
  "起業",
  "デザイン",
  "研究",
  "社会課題",
  "セキュリティ",
  "ゲーム",
  "地域",
  "アート",
  "医療",
  "海外",
] as const;

export const SORTS: { id: SortKey; label: string }[] = [
  { id: "recommend", label: "おすすめ" },
  { id: "cospa", label: "コスパ" },
  { id: "prize", label: "賞金順" },
  { id: "deadline", label: "締切順" },
  { id: "start", label: "開催日" },
  { id: "easy", label: "挑戦しやすい" },
];

export const STATUS_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: "open", label: "まだ間に合う" },
  { id: "soon", label: "14日以内" },
  { id: "closed", label: "終了" },
  { id: "all", label: "すべて" },
];

export const FORMAT_OPTIONS: { id: Format | "all"; label: string }[] = [
  { id: "all", label: "形式すべて" },
  { id: "online", label: "オンライン可" },
  { id: "hybrid", label: "ハイブリッド" },
  { id: "onsite", label: "現地" },
];

export const AREA_OPTIONS: { id: ProfileArea; label: string }[] = [
  { id: "all", label: "全国" },
  { id: "北海道・東北", label: "北海道・東北" },
  { id: "関東", label: "関東" },
  { id: "中部・北陸", label: "中部・北陸" },
  { id: "関西", label: "関西" },
  { id: "中国・四国", label: "中国・四国" },
  { id: "九州・沖縄", label: "九州・沖縄" },
  { id: "海外", label: "海外" },
];

export const PRIZE_OPTIONS = [
  { yen: 0, label: "賞金指定なし" },
  { yen: 100_000, label: "10万円〜" },
  { yen: 300_000, label: "30万円〜" },
  { yen: 1_000_000, label: "100万円〜" },
  { yen: 5_000_000, label: "500万円〜" },
];

export const ROLE_OPTIONS: { id: Role; label: string }[] = [
  { id: "highschool", label: "高校生" },
  { id: "university", label: "大学生" },
  { id: "graduate", label: "大学院" },
  { id: "working", label: "社会人" },
];

export const PROMPTS = [
  { label: "書類だけでコスパ", q: "書類選考だけのコスパの高いコンペ" },
  { label: "100万円以上", q: "100万円以上" },
  { label: "30万円以上のハッカソン", q: "30万円以上のハッカソン" },
  { label: "経験になる学生向け", q: "経験になる学生向けのコンペ" },
  { label: "オンライン", q: "オンライン" },
];

export const DEFAULT_FILTERS: Filters = {
  q: "",
  status: "open",
  categories: [],
  format: "all",
  area: "all",
  minPrize: 0,
  student: false,
  universityPlus: false,
  docOnly: false,
  beginner: false,
  savedOnly: false,
};

export const DEFAULT_PROFILE: Profile = {
  role: "university",
  area: "all",
  interests: [],
};

const PRESTIGE =
  /Y Combinator|NEDO|経済産業省|Google|OpenAI|スクウェア・エニックス|防衛装備庁|文部科学省|総務省|日本経済新聞|東京大学/;

const PLACE_EXTRAS: Record<string, string[]> = {
  名古屋: ["愛知"],
  渋谷: ["東京"],
  横浜: ["神奈川"],
  大阪: ["関西"],
  京都: ["関西"],
  神戸: ["兵庫", "関西"],
  福岡: ["九州・沖縄"],
  東海: ["愛知", "岐阜", "三重", "静岡", "名古屋", "浜松"],
  関東: ["関東"],
  関西: ["関西"],
  九州: ["九州・沖縄", "福岡", "沖縄"],
  北陸: ["石川", "富山", "福井", "金沢"],
  北海道: ["北海道・東北"],
  オンライン: ["オンライン"],
  海外: ["海外"],
};

export type Interpreted = {
  text: string;
  notes: string[];
  minPrize?: number;
  categories?: Category[];
  format?: Format;
  place?: string;
  student?: boolean;
  universityPlus?: boolean;
  docOnly?: boolean;
  beginner?: boolean;
  approachable?: boolean;
  sort?: SortKey;
};

export type Evaluation = {
  status: "open" | "soon" | "closed" | "unknown";
  days: number | null;
  whenLabel: string;
  deadlineLabel: string;
  startLabel: string;
  fit: number;
  fitReasons: string[];
  cospa: number;
  cospaReasons: string[];
  challenge: number;
  challengeLabel: string;
  challengeNote: string;
  recommend: number;
  prizeLabel: string;
};

export type Row = { c: Competition; ev: Evaluation };

export function todayISO(d = new Date()): string {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function daysUntil(iso: string, today: string): number {
  const a = Date.parse(`${today}T00:00:00`);
  const b = Date.parse(`${iso}T00:00:00`);
  return Math.round((b - a) / 86400000);
}

export function formatDate(iso: string, today: string): string {
  if (!iso) return "要確認";
  const [y, m, d] = iso.split("-").map(Number);
  const weekday = "日月火水木金土"[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const day = `${m}月${d}日（${weekday}）`;
  if (today.startsWith(String(y))) return day;
  return `${y}年${day}`;
}

export function deadlineLabel(c: Competition, today: string): string {
  if (c.deadline) return formatDate(c.deadline, today);
  if (c.rolling) return "随時";
  return "要確認";
}

export function eventDate(c: Competition): string {
  if (!c.starts) return "";
  if (c.deadline && c.starts < c.deadline) return "";
  return c.starts;
}

export function startLabel(c: Competition, today: string): string {
  const iso = eventDate(c);
  if (iso) return formatDate(iso, today);
  return "要確認";
}

export function formatYen(n: number): string {
  if (n >= 100_000_000) {
    const oku = n / 100_000_000;
    const text = Number.isInteger(oku) ? String(oku) : oku.toFixed(1).replace(/\.0$/, "");
    return `${text}億円`;
  }
  if (n >= 10_000) {
    const man = n / 10_000;
    const rounded = man >= 100 ? Math.round(man) : Math.round(man * 10) / 10;
    return `${String(rounded).replace(/\.0$/, "")}万円`;
  }
  return `${n.toLocaleString("ja-JP")}円`;
}

export function effortLabel(effort: Competition["effort"]): string {
  return { 1: "単発", 2: "軽め", 3: "数日〜数週間", 4: "数ヶ月" }[effort];
}

export function audienceLabel(audience: Audience): string {
  return {
    student: "学生向け",
    youth: "若手・高校生",
    researcher: "研究者向け",
    founder: "創業向け",
    anyone: "条件は広め",
  }[audience];
}

export function formatLabel(format: Format): string {
  return { online: "オンライン", hybrid: "ハイブリッド", onsite: "現地", unknown: "形式不明" }[format];
}

export function isTravelSupport(c: Competition): boolean {
  const text = c.prize || "";
  if (/賞金|最優秀|優勝|グランプリ|大賞|優秀賞|入賞|開発支援/.test(text)) return false;
  return /交通費|旅費|宿泊/.test(text);
}

export function prizeOf(c: Competition): number {
  if (isTravelSupport(c)) return 0;
  return c.topYen || c.poolYen;
}

function giftName(text: string): string {
  if (/図書カード|図書券/.test(text)) return "図書カード";
  if (/QUO|クオカード/.test(text)) return "QUOカード";
  if (/商品券/.test(text)) return "商品券";
  if (/ギフト/.test(text)) return "ギフト券";
  if (/ポイント|えらべるPay/.test(text)) return "ポイント";
  return "";
}

function primaryIsGift(text: string): boolean {
  const compact = text.replace(/[\s　,，]/g, "");
  if (!giftName(text)) return false;
  const amounts = [...compact.matchAll(/\d+(?:\.\d+)?万円|\d{3,}円/g)];
  if (!amounts.length) return false;
  return amounts.every((match) => {
    const around = compact.slice(Math.max(0, match.index - 12), match.index + match[0].length + 8);
    return /図書|QUO|クオ|商品券|ギフト|ポイント|Pay/.test(around);
  });
}

export function hasAward(c: Competition): boolean {
  const text = (c.prize || "").replace(/\s+/g, " ").trim();
  if (!text || /^(なし|無し|記載なし|−|-|参加費無料)$/.test(text)) return false;
  if (isTravelSupport(c)) return false;
  if (prizeOf(c) > 0) return true;
  return /賞|表彰|トロフィー|賞状|副賞|景品|賞品|ギフト|図書|商品券/.test(text);
}

export function prizeRank(c: Competition): number {
  const yen = prizeOf(c);
  if (yen > 0) return yen;
  return hasAward(c) ? 1 : 0;
}

export function prizeLabel(c: Competition): string {
  if (isTravelSupport(c)) {
    const text = c.prize.replace(/\s+/g, " ").trim();
    return text.length > 48 ? `${text.slice(0, 48)}…` : text;
  }
  const foreign = /\$|USD|USDC|ドル|ユーロ/.test(c.prize);
  const prefix = foreign ? "約" : "";
  const aid = /給付/.test(c.prize) ? "給付" : /貸与/.test(c.prize) ? "貸与" : "";
  const gift = primaryIsGift(c.prize) ? giftName(c.prize) : "";
  if (aid && (c.topYen || c.poolYen)) {
    const money = formatYen(c.topYen || c.poolYen);
    return /総額/.test(c.prize) ? `${aid} 総額${money}` : `${aid} ${prefix}${money}`;
  }
  if (c.topYen && c.poolYen > c.topYen * 1.15) {
    return `${prefix}最高${formatYen(c.topYen)} / 総額${formatYen(c.poolYen)}`;
  }
  if (c.topYen) return gift ? `${gift} ${prefix}最高${formatYen(c.topYen)}` : `${prefix}最高${formatYen(c.topYen)}`;
  if (c.poolYen) return gift ? `${gift} ${prefix}総額${formatYen(c.poolYen)}` : `${prefix}総額${formatYen(c.poolYen)}`;
  if (c.funding) return "出資・支援あり";
  if (c.prize && !/^(なし|無し|記載なし)$/.test(c.prize.trim())) {
    return c.prize.length > 48 ? `${c.prize.slice(0, 48)}…` : c.prize;
  }
  return "賞の記載なし";
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function moneyScore(c: Competition): number {
  const yen = isTravelSupport(c) ? 0 : c.topYen || (c.poolYen ? Math.round(c.poolYen * 0.25) : 0);
  if (yen <= 0) return c.funding ? 46 : 18;
  return clamp(Math.log10(yen) * 18 - 30, 8, 100);
}

function challengeScore(c: Competition): number {
  const yen = isTravelSupport(c) ? 0 : c.topYen || c.poolYen * 0.2;
  let score = 30;
  if (yen >= 100_000_000) score += 34;
  else if (yen >= 10_000_000) score += 28;
  else if (yen >= 1_000_000) score += 22;
  else if (yen >= 300_000) score += 14;
  else if (yen >= 50_000) score += 8;
  if (PRESTIGE.test(`${c.organizer} ${c.title}`)) score += 16;
  if (/アルゴリズム|最適化|CTF|強化学習|Kaggle/.test(`${c.title} ${c.summary}`)) score += 10;
  if (c.docOnly) score -= 8;
  if (c.beginner) score -= 10;
  if (c.effort >= 4) score += 8;
  if (c.category === "交流会") score -= 14;
  return clamp(score, 4, 99);
}

export function challengeLabel(score: number): string {
  if (score >= 80) return "最難関";
  if (score >= 62) return "難しい";
  if (score >= 42) return "ふつう";
  return "やさしい";
}

function challengeNote(c: Competition): string {
  const bits: string[] = [];
  if (!isTravelSupport(c) && (c.topYen >= 1_000_000 || c.poolYen >= 5_000_000)) bits.push("賞金額が大きい");
  if (PRESTIGE.test(`${c.organizer} ${c.title}`)) bits.push("主催の規模が大きい");
  if (/アルゴリズム|最適化|CTF|強化学習/.test(`${c.title} ${c.summary}`)) bits.push("実装の専門性が高い");
  if (c.docOnly) bits.push("企画や書類が中心");
  if (c.beginner) bits.push("初心者の参加余地がある");
  if (c.effort >= 4) bits.push("期間が長い");
  if (c.category === "交流会") bits.push("参加そのものが目的に近い");
  return bits.length ? bits.join("。") : "標準的な応募の重さ";
}

function statusOf(c: Competition, today: string): Evaluation["status"] {
  if (c.closedHint) return "closed";
  if (c.deadline) {
    if (c.deadline < today) return "closed";
    return daysUntil(c.deadline, today) <= 14 ? "soon" : "open";
  }
  if (c.rolling) return "open";
  if (c.starts) {
    if (c.starts < today) return "closed";
    return daysUntil(c.starts, today) <= 14 ? "soon" : "open";
  }
  return "unknown";
}

function fitScore(c: Competition, profile: Profile): { score: number; reasons: string[] } {
  let score = 58;
  const reasons: string[] = [];
  if (profile.role === "highschool") {
    if (c.audience === "youth") {
      score += 16;
      reasons.push("高校生でも狙いやすい");
    } else if (c.audience === "student" || c.forStudent) {
      score += 6;
      reasons.push("学生向け");
    } else if (c.audience === "founder" || c.audience === "researcher") score -= 12;
  } else if (profile.role === "university") {
    if (c.audience === "student" || c.audience === "youth" || c.forStudent) {
      score += 12;
      reasons.push("学生を想定した募集");
    } else if (c.audience === "anyone") score += 4;
    else if (c.audience === "founder") score -= 4;
  } else if (profile.role === "graduate") {
    if (c.audience === "researcher" || c.tags.includes("研究")) {
      score += 14;
      reasons.push("研究と相性がいい");
    } else if (c.forStudent) {
      score += 6;
      reasons.push("学生向け");
    }
  } else if (c.audience === "student") {
    score -= 16;
    reasons.push("学生限定に近い");
  } else if (c.audience === "founder" || c.audience === "anyone") {
    score += 8;
    reasons.push("社会人でも応募しやすい");
  }

  if (profile.interests.length) {
    const hit = c.tags.filter((tag) => profile.interests.includes(tag));
    if (hit.length) {
      score += Math.min(24, 12 + (hit.length - 1) * 6);
      reasons.push(`興味と一致: ${hit.join("・")}`);
    } else score -= 10;
  }

  if (profile.area !== "all") {
    if (c.format === "online" || c.area === "オンライン") {
      score += 10;
      reasons.push("オンラインで拠点を問わない");
    } else if (c.area === profile.area) {
      score += 12;
      reasons.push(`${c.region || c.area}で参加しやすい`);
    } else if (c.format === "onsite" && c.area !== "不明") score -= 14;
  }

  if (c.beginner) {
    score += 4;
    reasons.push("初心者の参加余地がある");
  }

  if (!reasons.length) {
    reasons.push(score >= 55 ? "条件との大きなズレは少ない" : "条件とは少しずれがある");
  }
  return { score: clamp(score), reasons: reasons.slice(0, 3) };
}

function cospaScore(c: Competition): { score: number; reasons: string[] } {
  let score = moneyScore(c) - (c.effort - 1) * 8;
  const reasons: string[] = [];
  if (isTravelSupport(c)) reasons.push("賞金ではなく交通費の支援");
  else if (c.topYen >= 1_000_000) reasons.push("個人の賞が100万円以上");
  else if (c.topYen >= 300_000) reasons.push("賞金がまとまっている");
  else if (c.poolYen >= 1_000_000) reasons.push("賞金総額が大きい");
  else if (c.funding) reasons.push("賞金より出資・ネットワーク寄り");
  else reasons.push("金額より経験寄り");
  if (c.docOnly) {
    score += 14;
    reasons.push("企画や書類が中心で手間が少ない");
  }
  if (c.format === "online") {
    score += 8;
    reasons.push("移動コストが低い");
  } else if (c.format === "hybrid") score += 4;
  if (c.effort >= 4) reasons.push("期間が長く拘束されやすい");
  return { score: clamp(score), reasons: reasons.slice(0, 3) };
}

export function evaluate(c: Competition, profile: Profile, today: string): Evaluation {
  const status = statusOf(c, today);
  const anchor = c.deadline || (c.rolling ? "" : c.starts);
  const days = anchor ? daysUntil(anchor, today) : null;
  let whenLabel = "日程は要確認";
  if (c.rolling && !c.deadline) whenLabel = "随時受付";
  else if (c.deadline) {
    if (days !== null && days < 0) whenLabel = `${formatDate(c.deadline, today)} 締切`;
    else if (days === 0) whenLabel = "本日締切";
    else whenLabel = `締切まであと${days}日`;
  } else if (c.starts) {
    if (days !== null && days < 0) whenLabel = `${formatDate(c.starts, today)} 開催`;
    else if (days === 0) whenLabel = "本日開催";
    else whenLabel = `開催まであと${days}日`;
  }

  const fit = fitScore(c, profile);
  const cospa = cospaScore(c);
  const challenge = challengeScore(c);
  let fresh = 55;
  if (status === "soon") fresh = 88;
  else if (status === "open") fresh = days !== null && days <= 45 ? 74 : 62;
  else if (status === "unknown") fresh = 40;
  else fresh = 8;

  return {
    status,
    days,
    whenLabel,
    deadlineLabel: deadlineLabel(c, today),
    startLabel: startLabel(c, today),
    fit: fit.score,
    fitReasons: fit.reasons,
    cospa: cospa.score,
    cospaReasons: cospa.reasons,
    challenge,
    challengeLabel: challengeLabel(challenge),
    challengeNote: challengeNote(c),
    recommend: clamp(fit.score * 0.5 + cospa.score * 0.35 + fresh * 0.15),
    prizeLabel: prizeLabel(c),
  };
}

function consume(rest: string, re: RegExp, apply: (match: RegExpMatchArray) => void): string {
  const match = rest.match(re);
  if (!match || match.index === undefined) return rest;
  apply(match);
  return `${rest.slice(0, match.index)} ${rest.slice(match.index + match[0].length)}`.replace(/\s+/g, " ").trim();
}

export function interpret(query: string): Interpreted {
  let rest = canonicalize(query.trim());
  const notes: string[] = [];
  const out: Interpreted = { text: "", notes };

  rest = consume(rest, /(\d+(?:\.\d+)?)\s*万円以上/, (m) => {
    out.minPrize = Number(m[1]) * 10_000;
    notes.push(`賞金${m[1]}万円以上`);
  });
  rest = consume(rest, /(\d+(?:\.\d+)?)\s*万円/, (m) => {
    if (!out.minPrize) {
      out.minPrize = Number(m[1]) * 10_000;
      notes.push(`賞金${m[1]}万円以上`);
    }
  });
  rest = consume(rest, /書類(?:選考|審査)?(?:だけ|のみ|中心)?/, () => {
    out.docOnly = true;
    notes.push("企画・書類が中心");
  });
  rest = consume(rest, /コスパ(?:の高い|重視|順)?/, () => {
    out.sort = "cospa";
    notes.push("コスパ順");
  });
  rest = consume(rest, /ハッカソン/, () => {
    out.categories = ["ハッカソン"];
    notes.push("ハッカソン");
  });
  rest = consume(rest, /ビジコン|ビジネスコンテスト|ビジネス・企画|ピッチ/, () => {
    out.categories = ["ビジネス・企画"];
    notes.push("ビジネス・企画");
  });
  let scholarship = false;
  rest = consume(rest, /奨学金/, () => {
    scholarship = true;
    notes.push("奨学金");
  });
  rest = consume(rest, /学術|論文|文芸/, () => {
    out.categories = ["文芸・論文"];
    notes.push("文芸・論文");
  });
  rest = consume(rest, /アクセラ|スタートアップ/, () => {
    if (!out.categories) {
      out.categories = ["ビジネス・企画"];
      notes.push("ビジネス・企画");
    }
  });
  rest = consume(rest, /交流会|ミートアップ/, () => {
    out.categories = ["交流会"];
    notes.push("交流会");
  });
  const genres: [RegExp, Category][] = [
    [/グラフィック|ポスター/, "グラフィック"],
    [/プロダクト|商品企画/, "プロダクト"],
    [/建築|インテリア/, "建築・空間"],
    [/ロゴ|キャラクター/, "ロゴ・キャラ"],
    [/イラスト|マンガ|漫画/, "イラスト"],
    [/絵画/, "絵画"],
    [/写真/, "写真"],
    [/映像|アニメ/, "映像"],
    [/川柳|俳句|短歌/, "川柳・短歌"],
    [/音楽|エンタメ/, "音楽・エンタメ"],
    [/ファッション|工芸/, "工芸・ファッション"],
    [/デジタル|アプリ/, "デジタル"],
  ];
  for (const [pattern, category] of genres) {
    rest = consume(rest, pattern, () => {
      if (!out.categories) {
        out.categories = [category];
        notes.push(category);
      }
    });
  }
  rest = consume(rest, /大学生以上|大学以上/, () => {
    out.universityPlus = true;
    notes.push("大学生以上");
  });
  rest = consume(rest, /学生向け|学生限定|学生/, () => {
    out.student = true;
    notes.push("学生向け");
  });
  rest = consume(rest, /初心者|未経験/, () => {
    out.beginner = true;
    notes.push("初心者歓迎");
  });
  rest = consume(rest, /経験になる|参加しやすい/, () => {
    out.approachable = true;
    notes.push("参加ハードル低め");
  });
  rest = consume(rest, /オンライン/, () => {
    out.format = "online";
    notes.push("オンライン可");
  });
  rest = consume(rest, /ハイブリッド/, () => {
    out.format = "hybrid";
    notes.push("ハイブリッド");
  });

  const places = [...new Set(PLACE_WORDS)].sort((a, b) => b.length - a.length);
  for (const place of places) {
    if (rest.includes(place)) {
      out.place = place;
      notes.push(place);
      rest = rest.replace(place, " ");
      break;
    }
  }

  if (scholarship && !out.categories) {
    const kinds: [RegExp, Category][] = [
      [/留学/, "留学"],
      [/スポーツ/, "スポーツ"],
      [/芸術|美術|音楽/, "芸術"],
      [/医療|看護|福祉/, "医療・福祉"],
      [/理工|工学/, "理工"],
      [/経済|ひとり親|児童養護/, "経済支援"],
      [/学業/, "学業"],
    ];
    for (const [pattern, category] of kinds) {
      if (!pattern.test(rest)) continue;
      out.categories = [category];
      notes.push(category);
      rest = rest.replace(pattern, " ");
      break;
    }
    if (!out.categories) out.categories = [...SCHOLARSHIP_CATEGORIES];
  }

  const bare = stripParticles(rest.replace(/コンペ|コンテスト|募集|だけ|高い|以上/g, ""));
  if (!bare) rest = "";
  else rest = stripParticles(rest);
  if (rest) notes.push(`キーワード「${rest}」`);
  out.text = rest;
  out.notes = notes;
  return out;
}

export function effectiveSort(filters: Filters, query: Interpreted): SortKey {
  return filters.sortOverride ?? query.sort ?? "recommend";
}

function mergeCategories(selected: Category[], query?: Category[]): Category[] | null {
  if (query?.length && selected.length) return selected.filter((cat) => query.includes(cat));
  if (query?.length) return query;
  if (selected.length) return selected;
  return null;
}

const hayCache = new WeakMap<Competition, { n: string; s: string; c: string }>();

function stripParticles(value: string) {
  return value.replace(/(?:^|\s)[のをにはが]+(?=\s|$)/g, " ").replace(/\s+/g, " ").trim();
}

function searchHay(c: Competition) {
  const cached = hayCache.get(c);
  if (cached) return cached;
  const raw = [c.title, c.organizer, c.summary, c.venue, c.prize, c.region, c.area, c.category, c.tags.join(" "), c.eligibility ?? "", c.reading ?? ""].join(" ");
  const normalized = norm(raw);
  const hay = { n: normalized, s: squash(raw), c: collapseVowels(normalized) };
  hayCache.set(c, hay);
  return hay;
}

function placeHit(c: Competition, place: string): boolean {
  const hay = searchHay(c);
  return [place, ...(PLACE_EXTRAS[place] ?? [])].some((word) => tokenHits(hay.n, hay.s, hay.c, word));
}

const PRE_UNIVERSITY = /高校生|中学生|小学生|小中|中高生|U-18|18歳以下|１８歳以下/;
const UNIVERSITY_PLUS = /大学生(?!による)|大学院|社会人|高専/;

function belowUniversity(c: Competition): boolean {
  const blob = `${c.title}\n${c.summary}\n${c.eligibility ?? ""}`;
  if (!PRE_UNIVERSITY.test(blob)) return false;
  if (UNIVERSITY_PLUS.test(blob)) return false;
  if (/(?<![中小高])学生[、,・／/\s]*高校生|高校生[、,・／/\s]*(?<![中小高])学生/.test(blob)) return false;
  return true;
}

export function matchRow(row: Row, filters: Filters, query: Interpreted, saved: number[]): boolean {
  const { c, ev } = row;
  if (filters.savedOnly && !saved.includes(c.id)) return false;
  if (filters.status === "open" && ev.status === "closed" && !query.text) return false;
  if (filters.status === "soon" && ev.status !== "soon") return false;
  if (filters.status === "closed" && ev.status !== "closed") return false;

  const categories = mergeCategories(filters.categories, query.categories);
  if (categories && !categories.includes(c.category)) return false;

  const format = query.format ?? (filters.format === "all" ? undefined : filters.format);
  if (format === "online" && c.format !== "online" && c.format !== "hybrid") return false;
  if (format && format !== "online" && c.format !== format) return false;

  if (filters.area !== "all") {
    const local = c.area === filters.area;
    const online = c.format === "online" || c.area === "オンライン";
    if (!local && !online) return false;
  }
  if (query.place && !placeHit(c, query.place)) return false;

  const minPrize = Math.max(filters.minPrize, query.minPrize ?? 0);
  if (minPrize > 0 && prizeOf(c) < minPrize) return false;
  if ((filters.student || query.student) && !c.forStudent && c.audience !== "student" && c.audience !== "youth") {
    return false;
  }
  if ((filters.universityPlus || query.universityPlus) && belowUniversity(c)) return false;
  if ((filters.docOnly || query.docOnly) && !c.docOnly) return false;
  if ((filters.beginner || query.beginner) && !c.beginner) return false;
  if (query.approachable && !(ev.challenge <= 68 && c.effort <= 3)) return false;

  if (query.text) {
    const hay = searchHay(c);
    const tokens = query.text.split(/\s+/).filter(Boolean);
    if (tokens.some((token) => !tokenHits(hay.n, hay.s, hay.c, token))) return false;
  }
  return true;
}

function dateRank(iso: string, today: string): string {
  if (!iso) return `2-${"9".repeat(8)}`;
  if (iso < today) return `3-${iso}`;
  return `1-${iso}`;
}

export function sortRows(rows: Row[], sort: SortKey, today: string): Row[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (sort !== "deadline" && sort !== "start") {
      const closed = Number(a.ev.status === "closed") - Number(b.ev.status === "closed");
      if (closed) return closed;
    }
    if (sort === "cospa" && b.ev.cospa !== a.ev.cospa) return b.ev.cospa - a.ev.cospa;
    if (sort === "prize" && prizeRank(b.c) !== prizeRank(a.c)) return prizeRank(b.c) - prizeRank(a.c);
    if (sort === "easy" && a.ev.challenge !== b.ev.challenge) return a.ev.challenge - b.ev.challenge;
    if (sort === "deadline") {
      const rank = dateRank(a.c.deadline || a.c.starts, today).localeCompare(dateRank(b.c.deadline || b.c.starts, today));
      if (rank) return rank;
    }
    if (sort === "start") {
      const rank = dateRank(eventDate(a.c), today).localeCompare(dateRank(eventDate(b.c), today));
      if (rank) return rank;
    }
    if (sort === "recommend" && b.ev.recommend !== a.ev.recommend) return b.ev.recommend - a.ev.recommend;
    return a.c.title.localeCompare(b.c.title, "ja");
  });
  return copy;
}

export function isSort(value: string | null): value is SortKey {
  return SORTS.some((item) => item.id === value);
}

export function isStatus(value: string | null): value is StatusFilter {
  return STATUS_OPTIONS.some((item) => item.id === value);
}

export function isView(value: string | null): value is import("./types").View {
  return value === "cards" || value === "board" || value === "calendar";
}

export function readFilters(search: string): Filters {
  const params = new URLSearchParams(search);
  const categories = [
    ...new Set(
      (params.get("cat") ?? "").split(",").flatMap((item) => {
        if (item === "奨学金") return SCHOLARSHIP_CATEGORIES;
        return [LEGACY_CATEGORY[item] ?? item];
      }),
    ),
  ].filter((item): item is Category => CATEGORIES.includes(item as Category));
  const format = params.get("format");
  const area = params.get("area");
  const sort = params.get("sort");
  let status: StatusFilter = "open";
  if (params.get("upcoming") === "false") status = "all";
  if (isStatus(params.get("status"))) status = params.get("status") as StatusFilter;
  const filters: Filters = {
    ...DEFAULT_FILTERS,
    q: params.get("q") ?? "",
    status,
    categories,
    format: format === "online" || format === "hybrid" || format === "onsite" ? format : "all",
    area: AREA_OPTIONS.some((item) => item.id === area) ? (area as ProfileArea) : "all",
    minPrize: Number(params.get("prize") ?? 0) || 0,
    student: params.get("student") === "1",
    universityPlus: params.get("uni") === "1",
    docOnly: params.get("doc") === "1",
    beginner: params.get("beginner") === "1",
    savedOnly: params.get("saved") === "1",
  };
  if (sort === "score") filters.sortOverride = "recommend";
  else if (isSort(sort)) filters.sortOverride = sort;
  return filters;
}

export function filtersToSearch(filters: Filters, view: import("./types").View, selected: number | null): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status !== "open") params.set("status", filters.status);
  if (filters.sortOverride && filters.sortOverride !== "recommend") params.set("sort", filters.sortOverride);
  if (view !== "cards") params.set("view", view);
  if (filters.categories.length) params.set("cat", filters.categories.join(","));
  if (filters.format !== "all") params.set("format", filters.format);
  if (filters.area !== "all") params.set("area", filters.area);
  if (filters.minPrize) params.set("prize", String(filters.minPrize));
  if (filters.student) params.set("student", "1");
  if (filters.universityPlus) params.set("uni", "1");
  if (filters.docOnly) params.set("doc", "1");
  if (filters.beginner) params.set("beginner", "1");
  if (filters.savedOnly) params.set("saved", "1");
  if (selected) params.set("id", String(selected));
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem("cz-profile");
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Partial<Profile>;
    const role = ROLE_OPTIONS.some((item) => item.id === parsed.role) ? parsed.role! : DEFAULT_PROFILE.role;
    const area = AREA_OPTIONS.some((item) => item.id === parsed.area) ? parsed.area! : "all";
    const interests = Array.isArray(parsed.interests)
      ? parsed.interests.filter((tag): tag is string => (TAGS as readonly string[]).includes(tag))
      : [];
    return { role, area, interests };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function loadIds(key: string): number[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "number") : [];
  } catch {
    return [];
  }
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function buildMonth(year: number, month: number): Array<number | null> {
  const first = new Date(year, month, 1);
  const pad = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = Array.from({ length: pad }, () => null);
  for (let day = 1; day <= days; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function isoFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
