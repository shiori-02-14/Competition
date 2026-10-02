#!/usr/bin/env python3
"""公開コンペ一覧を、画面で使える形に整える。"""

from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "source.json"
OUT = ROOT / "src" / "data" / "competitions.ts"
RAW_FALLBACK = Path("/tmp/comps_raw.json")

PREFS = {
    "北海道": "北海道・東北",
    "青森": "北海道・東北",
    "岩手": "北海道・東北",
    "宮城": "北海道・東北",
    "秋田": "北海道・東北",
    "山形": "北海道・東北",
    "福島": "北海道・東北",
    "茨城": "関東",
    "栃木": "関東",
    "群馬": "関東",
    "埼玉": "関東",
    "千葉": "関東",
    "東京": "関東",
    "神奈川": "関東",
    "新潟": "中部・北陸",
    "富山": "中部・北陸",
    "石川": "中部・北陸",
    "福井": "中部・北陸",
    "山梨": "中部・北陸",
    "長野": "中部・北陸",
    "岐阜": "中部・北陸",
    "静岡": "中部・北陸",
    "愛知": "中部・北陸",
    "三重": "中部・北陸",
    "滋賀": "関西",
    "京都": "関西",
    "大阪": "関西",
    "兵庫": "関西",
    "奈良": "関西",
    "和歌山": "関西",
    "鳥取": "中国・四国",
    "島根": "中国・四国",
    "岡山": "中国・四国",
    "広島": "中国・四国",
    "山口": "中国・四国",
    "徳島": "中国・四国",
    "香川": "中国・四国",
    "愛媛": "中国・四国",
    "高知": "中国・四国",
    "福岡": "九州・沖縄",
    "佐賀": "九州・沖縄",
    "長崎": "九州・沖縄",
    "熊本": "九州・沖縄",
    "大分": "九州・沖縄",
    "宮崎": "九州・沖縄",
    "鹿児島": "九州・沖縄",
    "沖縄": "九州・沖縄",
}

CITY_ALIASES = [
    ("サンフランシスコ", "海外:サンフランシスコ"),
    ("シリコンバレー", "海外:シリコンバレー"),
    ("シンガポール", "海外:シンガポール"),
    ("サンフランシスコ", "海外:サンフランシスコ"),
    ("San Francisco", "海外:サンフランシスコ"),
    ("Silicon Valley", "海外:シリコンバレー"),
    ("Singapore", "海外:シンガポール"),
    ("Dubai", "海外:ドバイ"),
    ("Seoul", "海外:ソウル"),
    ("トロント", "海外:トロント"),
    ("ミラノ", "海外:ミラノ"),
    ("アメリカ", "海外:アメリカ"),
    ("米国", "海外:アメリカ"),
    ("インド", "海外:インド"),
    ("カナダ", "海外:カナダ"),
    ("東京都", "東京"),
    ("都内", "東京"),
    ("名古屋駅", "愛知"),
    ("名古屋", "愛知"),
    ("豊橋", "愛知"),
    ("豊田", "愛知"),
    ("岡崎", "愛知"),
    ("浜松", "静岡"),
    ("静岡", "静岡"),
    ("金沢", "石川"),
    ("横浜", "神奈川"),
    ("鎌倉", "神奈川"),
    ("川崎", "神奈川"),
    ("札幌", "北海道"),
    ("仙台", "宮城"),
    ("渋谷", "東京"),
    ("新宿", "東京"),
    ("虎ノ門", "東京"),
    ("六本木", "東京"),
    ("丸の内", "東京"),
    ("品川", "東京"),
    ("銀座", "東京"),
    ("秋葉原", "東京"),
    ("表参道", "東京"),
    ("原宿", "東京"),
    ("日本橋", "東京"),
    ("お台場", "東京"),
    ("梅田", "大阪"),
    ("難波", "大阪"),
    ("なんば", "大阪"),
    ("京都", "京都"),
    ("神戸", "兵庫"),
    ("奈良", "奈良"),
    ("和歌山", "和歌山"),
    ("福岡", "福岡"),
    ("博多", "福岡"),
    ("北九州", "福岡"),
    ("広島", "広島"),
    ("那覇", "沖縄"),
    ("沖縄", "沖縄"),
    ("岐阜", "岐阜"),
    ("福井", "福井"),
    ("三重", "三重"),
    ("長野", "長野"),
    ("新潟", "新潟"),
    ("富山", "富山"),
    ("岡山", "岡山"),
    ("熊本", "熊本"),
    ("鹿児島", "鹿児島"),
    ("つくば", "茨城"),
    ("水戸", "茨城"),
    ("宇都宮", "栃木"),
    ("前橋", "群馬"),
    ("さいたま", "埼玉"),
    ("大宮", "埼玉"),
    ("千葉", "千葉"),
    ("函館", "北海道"),
    ("四日市", "三重"),
    ("伊勢", "三重"),
    ("金沢", "石川"),
    ("松本", "長野"),
    ("甲府", "山梨"),
    ("高松", "香川"),
    ("松山", "愛媛"),
    ("高知", "高知"),
    ("徳島", "徳島"),
    ("長崎", "長崎"),
    ("大分", "大分"),
    ("宮崎", "宮崎"),
    ("佐賀", "佐賀"),
    ("那覇", "沖縄"),
    ("大阪", "大阪"),
    ("東京", "東京"),
]

TAGS = [
    ("AI", r"AI|人工知能|LLM|生成AI|機械学習|エージェント"),
    ("開発", r"開発|エンジニア|プログラミング|アプリ|実装|ソフトウェア"),
    ("起業", r"起業|スタートアップ|ビジネスプラン|ピッチ|事業化|アントレ"),
    ("デザイン", r"デザイン|UI|UX|プロダクトデザイン"),
    ("研究", r"研究|学術|論文|奨学金|博士|大学院|研究者"),
    ("社会課題", r"社会課題|地域課題|ソーシャル|SDGs|サステナ|脱炭素"),
    ("セキュリティ", r"セキュリティ|CTF|サイバー"),
    ("ゲーム", r"ゲーム|ゲームコンテスト"),
    ("地域", r"地域|地方創生|まちづくり|地元"),
    ("アート", r"アート|芸術|映画|写真|クリエイ"),
    ("医療", r"医療|介護|ヘルスケア|健康|ケア"),
    ("海外", r"海外|グローバル|渡航|留学|シリコンバレー|San Francisco"),
]

TEN = {"上旬": 5, "中旬": 15, "下旬": 25}
TRACK = {"fbclid", "gclid", "mc_eid", "mc_cid", "igshid", "mibextid"}


def valid(iso: str) -> bool:
    try:
        y, m, d = map(int, iso.split("-"))
        date(y, m, d)
        return 2000 <= y <= 2035
    except Exception:
        return False


def fmt(y, m, d) -> str:
    return f"{int(y):04d}-{int(m):02d}-{int(d):02d}"


def extract_dates(text: str, year: int) -> list[str]:
    if not text:
        return []
    used = [False] * (len(text) + 1)
    found: list[str] = []

    def claim(a: int, b: int, iso: str) -> None:
        if a < 0 or b > len(text) or any(used[a:b]):
            return
        if not valid(iso):
            return
        for i in range(a, b):
            used[i] = True
        found.append(iso)

    patterns = [
        (r"(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})", lambda m: fmt(m.group(1), m.group(2), m.group(3))),
        (r"(20\d{2})年(\d{1,2})月(上旬|中旬|下旬)", lambda m: fmt(m.group(1), m.group(2), TEN[m.group(3)])),
        (r"(?<!\d)(\d{1,2})月(\d{1,2})日", lambda m: fmt(year, m.group(1), m.group(2))),
        (r"(?<!\d)(\d{1,2})月(上旬|中旬|下旬)", lambda m: fmt(year, m.group(1), TEN[m.group(2)])),
    ]
    for pat, build in patterns:
        for m in re.finditer(pat, text):
            claim(m.start(), m.end(), build(m))
    return found


def infer_year(item: dict, text: str) -> int:
    m = re.search(r"(20\d{2})", text or "")
    if m:
        return int(m.group(1))
    m = re.search(r"(20\d{2})", f"{item.get('title','')} {item.get('summary','')}")
    if m:
        return int(m.group(1))
    return 2026


def pick_date(item: dict, text: str, iso_hint: str, mode: str) -> str:
    if iso_hint and valid(iso_hint):
        return iso_hint
    if not text or text.strip() in {"-", "−", "null", "なし"}:
        return ""
    dates = extract_dates(text, infer_year(item, text))
    if not dates:
        return ""
    return max(dates) if mode == "max" else min(dates)


def mask_amounts(text: str) -> list[tuple[int, int]]:
    """Return (yen, start index) without double-counting overlapping patterns."""
    compact = text.replace(",", "").replace("，", "").replace(" ", "").replace("　", "")
    # Map compact index back is hard; search on a space-stripped copy and use that string only.
    src = compact
    used = [False] * len(src)
    found: list[tuple[int, int]] = []

    def claim(a: int, b: int, yen: int) -> None:
        if yen <= 0 or any(used[a:b]):
            return
        for i in range(a, b):
            used[i] = True
        found.append((yen, a))

    for m in re.finditer(r"(\d+(?:\.\d+)?)万ドル", src):
        claim(m.start(), m.end(), int(float(m.group(1)) * 10000 * 150))
    for m in re.finditer(r"(\d+(?:\.\d+)?)億(?:(\d+(?:\.\d+)?)万)?円", src):
        yen = float(m.group(1)) * 100_000_000
        if m.group(2):
            yen += float(m.group(2)) * 10_000
        claim(m.start(), m.end(), int(yen))
    for m in re.finditer(r"(\d+(?:\.\d+)?)万円", src):
        claim(m.start(), m.end(), int(float(m.group(1)) * 10_000))
    for m in re.finditer(r"\$(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)(?:USD|USDC)", src):
        num = float(m.group(1) or m.group(2))
        claim(m.start(), m.end(), int(num * 150))
    for m in re.finditer(r"(\d{4,})円", src):
        claim(m.start(), m.end(), int(m.group(1)))
    return found


def parse_prize(text: str) -> tuple[int, int]:
    if not text:
        return 0, 0
    src = text.replace(",", "").replace("，", "").replace(" ", "").replace("　", "")
    amounts = mask_amounts(text)
    tops: list[int] = []
    pools: list[int] = []
    others: list[int] = []
    for yen, pos in amounts:
        window = src[max(0, pos - 16) : pos]
        if re.search(r"総額|懸賞金", window) and not re.search(r"1位|１位|最優秀|優勝|グランプリ|大賞", window):
            pools.append(yen)
        elif re.search(r"最優秀|優勝|グランプリ|大賞|1位|１位|最高", window):
            tops.append(yen)
        else:
            others.append(yen)
    if tops:
        top = max(tops)
    elif others and pools:
        top = max(others)
    elif others and not pools:
        top = max(others)
    else:
        top = 0
    pool = max(pools) if pools else 0
    if pool and top and pool < top:
        pool = max(pool, top)
    return top, pool


def find_place(text: str) -> str:
    if not text:
        return ""
    aliases = [(a, b) for a, b in CITY_ALIASES]
    aliases.extend((name, name) for name in PREFS)
    aliases.sort(key=lambda x: len(x[0]), reverse=True)
    for alias, target in aliases:
        if alias and alias in text:
            return target
    return ""


def clean_url(url: str) -> str:
    try:
        parts = urlsplit(url)
    except Exception:
        return url
    query = [
        (k, v)
        for k, v in parse_qsl(parts.query, keep_blank_values=True)
        if k.lower() not in TRACK and not k.lower().startswith("utm_")
    ]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), ""))


def canon_url(url: str) -> str:
    parts = urlsplit(url)
    host = parts.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    path = parts.path.rstrip("/")
    return host + path


def title_key(title: str) -> str:
    return re.sub(r"\s+", "", title).replace("！", "!").replace("　", "").lower()


def richness(item: dict) -> tuple:
    return (
        bool(item.get("deadline")),
        bool(item.get("image")),
        len(item.get("prize") or ""),
        len(item.get("summary") or ""),
        len(item.get("venue") or ""),
    )


def build(item: dict) -> dict:
    title = (item.get("title") or "").strip()
    organizer = (item.get("organizer") or "").strip()
    summary = (item.get("summary") or "").strip()
    prize = (item.get("prize") or "").strip()
    venue = (item.get("venue") or "").strip()
    if venue in {"-", "−", "null", "なし"}:
        venue = ""
    blob = "\n".join([title, organizer, summary, prize, venue])
    category = item.get("category") or "その他"
    if category in {"不明", ""}:
        category = "その他"

    deadline = pick_date(item, item.get("deadlineText") or "", item.get("deadline") or "", "max")
    starts = pick_date(item, item.get("startsText") or "", item.get("starts") or "", "min")
    rolling = bool(re.search(r"随時|通年", item.get("deadlineText") or ""))
    closed_hint = bool(re.search(r"受付は終了|締め切りました|募集終了|新規エントリー受付は終了", blob))

    place = find_place(venue) or find_place(summary) or find_place(title)
    if place.startswith("海外:"):
        region = place.split(":", 1)[1]
        area = "海外"
    elif place in PREFS:
        region = place
        area = PREFS[place]
    elif re.search(r"オンライン|online|Online|Zoom", venue):
        region = "オンライン"
        area = "オンライン"
    else:
        region = ""
        area = "不明"

    has_online = bool(re.search(r"オンライン|online|Online|Zoom", blob))
    hybrid_word = bool(re.search(r"ハイブリッド|併用|およびオンライン|／オンライン|とオンライン|オンライン /", blob))
    pref_hit = bool(region and area not in {"オンライン", "不明", "海外"}) or area == "海外"
    if hybrid_word or (has_online and area not in {"オンライン", "不明", "海外"} and region):
        fmt_kind = "hybrid"
    elif has_online and area in {"オンライン", "不明"}:
        fmt_kind = "online"
    elif region or venue:
        fmt_kind = "onsite" if not (has_online and area == "海外") else "hybrid"
    else:
        fmt_kind = "unknown"
    if area == "海外" and has_online and not hybrid_word:
        fmt_kind = "onsite"
    if region == "オンライン":
        fmt_kind = "hybrid" if pref_hit and area not in {"オンライン", "不明"} else "online"

    if re.search(r"高校生限定|中学生|小中高|U-18|18歳以下", blob):
        audience = "youth"
    elif re.search(r"学生限定|学生のみ|学生向け|学生対象|学生のための|学生が主体|学生起業", blob):
        audience = "student"
    elif re.search(r"大学院|研究者|博士", blob) and not re.search(r"学生向け|大学生", blob):
        audience = "researcher"
    elif re.search(r"社会人限定|創業者限定|スタートアップを対象", blob) and not re.search(r"学生", blob):
        audience = "founder"
    elif re.search(r"高校生|大学生|学生|高専", blob):
        audience = "student"
    elif re.search(r"若手|U-25|25歳以下|30歳まで", blob):
        audience = "youth"
    else:
        audience = "anyone"

    for_student = bool(re.search(r"学生|高校生|高専|大学生|大学院生", blob))
    is_build = bool(re.search(r"ハッカソン|実装|プロトタイプ|試作品|ソースコード|開発して|作品を開発|アプリを開発", blob))
    is_doc = bool(re.search(r"書類選考|書類審査|企画書|アイデアを募集|アイデア段階|エントリーシート|小論文|400字|ビジネスプラン", blob))
    doc_only = category != "ハッカソン" and is_doc and not is_build
    if category == "ビジコン" and re.search(r"アイデア|ビジネスプラン|企画", blob) and not is_build:
        doc_only = True

    beginner = bool(
        re.search(r"初心者|未経験|初めての|はじめての|経験不問|知識がなくても|プログラミング経験不要|専門知識がなくても|気軽に参加", blob)
    )
    tags = [name for name, pat in TAGS if re.search(pat, blob, re.I)][:6]
    funding = bool(re.search(r"出資|資金調達|エクイティ|Investment|funding", blob, re.I))
    top, pool = parse_prize(prize)

    if re.search(r"\d\s*ヶ?月|か月|半年|合宿|渡航|アクセラレー", blob) or category == "アクセラレーション":
        effort = 4
    elif category == "交流会" or (
        re.search(r"交流会|説明会|ミートアップ|Meetup|ワークショップ", blob) and category != "ハッカソン"
    ):
        effort = 1
    elif category == "ハッカソン" or re.search(r"ハッカソン", blob):
        effort = 3
    elif doc_only:
        effort = 2
    else:
        effort = 2

    return {
        "id": item["id"],
        "title": title,
        "organizer": organizer,
        "summary": summary,
        "url": clean_url(item.get("url") or ""),
        "image": item.get("image") or "",
        "category": category,
        "deadline": deadline,
        "starts": starts,
        "rolling": rolling,
        "venue": venue,
        "prize": prize,
        "topYen": top,
        "poolYen": pool,
        "funding": funding,
        "region": region,
        "area": area,
        "format": fmt_kind,
        "audience": audience,
        "forStudent": for_student,
        "docOnly": doc_only,
        "beginner": beginner,
        "tags": tags,
        "effort": effort,
        "closedHint": closed_hint,
    }


def dedupe(rows: list[dict]) -> list[dict]:
    def keep(group: list[dict]) -> dict:
        return sorted(group, key=richness, reverse=True)[0]

    by_url: dict[str, list[dict]] = {}
    for row in rows:
        key = canon_url(row["url"])
        by_url.setdefault(key or f"id:{row['id']}", []).append(row)
    once = [keep(v) for v in by_url.values()]
    by_title: dict[str, list[dict]] = {}
    for row in once:
        by_title.setdefault(title_key(row["title"]), []).append(row)
    return [keep(v) for v in by_title.values()]


def main() -> None:
    if not SOURCE.exists():
        SOURCE.parent.mkdir(parents=True, exist_ok=True)
        SOURCE.write_text(RAW_FALLBACK.read_text(), encoding="utf-8")
    raw = json.loads(SOURCE.read_text(encoding="utf-8"))
    built = [build(item) for item in raw if (item.get("title") or "").strip()]
    rows = dedupe(built)
    rows.sort(key=lambda r: (r["deadline"] or "9999", r["title"]))

    assert parse_prize("最優秀賞：賞金3億円（1作品）、傑作賞：1億円")[0] == 300_000_000
    assert parse_prize("賞金総額1500万円（1位: 500万円、2位: 400万円）") == (5_000_000, 15_000_000)
    top, pool = parse_prize("懸賞金総額 約6.3億円")
    assert top == 0 and pool == 630_000_000

    payload = json.dumps(rows, ensure_ascii=False, indent=2)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        "import type { Competition } from \"../types\";\n\n"
        "export const DATA_AS_OF = \"2026-10-02\";\n\n"
        f"export const competitions: Competition[] = {payload};\n",
        encoding="utf-8",
    )
    today = date(2026, 10, 2)

    def status(r: dict) -> str:
        if r["closedHint"]:
            return "closed"
        if r["deadline"]:
            d = date.fromisoformat(r["deadline"])
            if d < today:
                return "closed"
            return "soon" if (d - today).days <= 14 else "open"
        if r["rolling"]:
            return "open"
        if r["starts"]:
            d = date.fromisoformat(r["starts"])
            if d < today:
                return "closed"
            return "soon" if (d - today).days <= 14 else "open"
        return "unknown"

    from collections import Counter

    print("raw", len(raw), "built", len(built), "deduped", len(rows))
    print("status", Counter(status(r) for r in rows))
    print("category", Counter(r["category"] for r in rows))
    print("format", Counter(r["format"] for r in rows))
    print("doc", sum(r["docOnly"] for r in rows), "student", sum(r["forStudent"] for r in rows))
    open_rows = [r for r in rows if status(r) in {"open", "soon"}]
    open_rows.sort(key=lambda r: r["topYen"] or r["poolYen"], reverse=True)
    print("--- open by prize ---")
    for r in open_rows[:12]:
        print(f"{r['category'][:4]:4} {r['deadline'] or r['starts'] or '-':10} {r['topYen'] or r['poolYen']:10} {r['title'][:42]}")


if __name__ == "__main__":
    main()
