export type Category =
  | "ハッカソン"
  | "ビジネス・企画"
  | "デジタル"
  | "グラフィック"
  | "プロダクト"
  | "建築・空間"
  | "ロゴ・キャラ"
  | "イラスト"
  | "絵画"
  | "写真"
  | "映像"
  | "川柳・短歌"
  | "文芸・論文"
  | "音楽・エンタメ"
  | "工芸・ファッション"
  | "交流会"
  | "その他"
  | "学業"
  | "留学"
  | "スポーツ"
  | "芸術"
  | "医療・福祉"
  | "理工"
  | "経済支援";

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
  reading?: string;
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

export type Kind = "contest" | "scholarship";
export type SortKey = "recommend" | "cospa" | "prize" | "deadline" | "start" | "easy";
export type StatusFilter = "open" | "soon" | "all" | "closed";
export type View = "cards" | "board" | "calendar";

export type Filters = {
  kind: Kind;
  q: string;
  status: StatusFilter;
  categories: Category[];
  format: Format | "all";
  area: ProfileArea;
  minPrize: number;
  student: boolean;
  universityPlus: boolean;
  docOnly: boolean;
  beginner: boolean;
  savedOnly: boolean;
  sortOverride?: SortKey;
};
