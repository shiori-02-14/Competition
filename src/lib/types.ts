export type Category =
  | "ハッカソン"
  | "ビジコン"
  | "学術"
  | "奨学金"
  | "スタートアップ"
  | "アクセラレーション"
  | "交流会"
  | "その他";

export type Format = "online" | "hybrid" | "onsite" | "unknown";

export type Audience = "student" | "youth" | "researcher" | "founder" | "anyone";

export type Area =
  | "北海道・東北"
  | "関東"
  | "中部・北陸"
  | "関西"
  | "中国・四国"
  | "九州・沖縄"
  | "海外"
  | "オンライン"
  | "不明";

export type Competition = {
  id: number;
  title: string;
  organizer: string;
  summary: string;
  url: string;
  image: string;
  category: Category;
  deadline: string;
  starts: string;
  rolling: boolean;
  venue: string;
  prize: string;
  topYen: number;
  poolYen: number;
  funding: boolean;
  region: string;
  area: Area;
  format: Format;
  audience: Audience;
  forStudent: boolean;
  docOnly: boolean;
  beginner: boolean;
  tags: string[];
  effort: 1 | 2 | 3 | 4;
  closedHint: boolean;
  eligibility?: string;
  origin?: string;
};

export type Role = "highschool" | "university" | "graduate" | "working";
export type ProfileArea =
  | "all"
  | "北海道・東北"
  | "関東"
  | "中部・北陸"
  | "関西"
  | "中国・四国"
  | "九州・沖縄"
  | "海外";

export type Profile = {
  role: Role;
  area: ProfileArea;
  interests: string[];
};

export type SortKey = "recommend" | "cospa" | "prize" | "deadline" | "start" | "easy";
export type StatusFilter = "open" | "soon" | "all" | "closed";
export type View = "cards" | "board" | "calendar";

export type Filters = {
  q: string;
  status: StatusFilter;
  categories: Category[];
  format: Format | "all";
  area: ProfileArea;
  minPrize: number;
  student: boolean;
  docOnly: boolean;
  beginner: boolean;
  savedOnly: boolean;
  sortOverride?: SortKey;
};
