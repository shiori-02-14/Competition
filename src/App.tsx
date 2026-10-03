import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Board, Calendar, Card, Detail, Empty } from "./components";
import {
  AREA_OPTIONS,
  CATEGORIES,
  CONTEST_CATEGORIES,
  DEFAULT_FILTERS,
  FORMAT_OPTIONS,
  PRIZE_OPTIONS,
  PROMPTS,
  ROLE_OPTIONS,
  SCHOLARSHIP_CATEGORIES,
  SORTS,
  STATUS_OPTIONS,
  TAGS,
  effectiveSort,
  evaluate,
  filtersToSearch,
  interpret,
  isScholarship,
  isView,
  loadIds,
  loadProfile,
  matchRow,
  readFilters,
  sortRows,
  todayISO,
} from "./lib/logic";
import { installSearchIndex, searchGeneration } from "./lib/kana";
import type { Category, Competition, Filters, Profile, SortKey, View } from "./lib/types";

type SourceReport = { id: string; label: string; ok: boolean; fetched: number; error?: string };
type Catalog = {
  updatedAt: string;
  sources: SourceReport[];
  competitions: Competition[];
  lexicon?: [string, string][];
  words?: string[];
};

function readView(search: string): View {
  const view = new URLSearchParams(search).get("view");
  return isView(view) ? view : "cards";
}

function readSelected(search: string): number | null {
  const id = Number(new URLSearchParams(search).get("id"));
  return Number.isFinite(id) && id > 0 ? id : null;
}

export default function App() {
  const today = todayISO();
  const [filters, setFilters] = useState<Filters>(() => readFilters(window.location.search));
  const [view, setView] = useState<View>(() => readView(window.location.search));
  const [selected, setSelected] = useState<number | null>(() => readSelected(window.location.search));
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [saved, setSaved] = useState<number[]>(() => loadIds("cz-saved"));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const [year, month] = today.split("-").map(Number);
    return { year, month: month - 1 };
  });
  const [focusDay, setFocusDay] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let stop = false;
    fetch(`${import.meta.env.BASE_URL}competitions.json`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        return (await response.json()) as Catalog;
      })
      .then((data) => {
        if (stop) return;
        installSearchIndex({ lexicon: data.lexicon, words: data.words });
        setCatalog(data);
      })
      .catch(() => {
        if (!stop) setLoadError("募集データを読み込めませんでした");
      });
    return () => {
      stop = true;
    };
  }, []);

  const competitions = catalog?.competitions ?? [];
  const evaluated = useMemo(
    () => competitions.map((item) => ({ c: item, ev: evaluate(item, profile, today) })),
    [competitions, profile, today],
  );
  const searchGen = searchGeneration();
  const query = useMemo(() => {
    void searchGen;
    return interpret(filters.q);
  }, [filters.q, searchGen]);
  const sort = effectiveSort(filters, query);
  const filtered = useMemo(
    () => sortRows(evaluated.filter((row) => matchRow(row, filters, query, saved)), sort, today),
    [evaluated, filters, query, saved, sort, today],
  );
  const counts = useMemo(() => {
    const base = evaluated.filter((row) => matchRow(row, { ...filters, categories: [] }, query, saved));
    return Object.fromEntries(CATEGORIES.map((cat) => [cat, base.filter((row) => row.c.category === cat).length]));
  }, [evaluated, filters, query, saved]);

  useEffect(() => {
    const next = filtersToSearch(filters, view, selected);
    const current = `${window.location.pathname}${window.location.search}`;
    const target = `${window.location.pathname}${next}`;
    if (current !== target) window.history.replaceState(null, "", target);
  }, [filters, view, selected]);

  useEffect(() => {
    localStorage.setItem("cz-profile", JSON.stringify(profile));
  }, [profile]);
  useEffect(() => {
    localStorage.setItem("cz-saved", JSON.stringify(saved));
  }, [saved]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      event.preventDefault();
      document.getElementById("q")?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const shortcutRows = useMemo(
    () => evaluated.filter((row) => matchRow(row, { ...filters, status: "all", savedOnly: false }, query, saved)),
    [evaluated, filters, query, saved],
  );
  const openCount = shortcutRows.filter((row) => row.ev.status !== "closed").length;
  const soonCount = shortcutRows.filter((row) => row.ev.status === "soon").length;
  const savedCount = shortcutRows.filter((row) => saved.includes(row.c.id)).length;
  const quick = filters.savedOnly ? "saved" : filters.status === "soon" ? "soon" : filters.status === "open" ? "open" : null;
  const selectedRow = evaluated.find((row) => row.c.id === selected) ?? null;
  const browsing =
    view === "cards" &&
    !filters.q &&
    filters.status === "open" &&
    filters.categories.length === 0 &&
    filters.format === "all" &&
    filters.area === "all" &&
    filters.minPrize === 0 &&
    !filters.student &&
    !filters.universityPlus &&
    !filters.docOnly &&
    !filters.beginner &&
    !filters.savedOnly;
  const scholarshipRows = filtered.filter((row) => isScholarship(row.c.category));
  const contestRows = filtered.filter((row) => !isScholarship(row.c.category));
  const splitScholarships = view === "cards" && scholarshipRows.length > 0 && contestRows.length > 0;
  const mainRows = splitScholarships ? contestRows : filtered;
  const featured = browsing && sort === "recommend" ? mainRows.slice(0, 3) : [];
  const list = featured.length ? mainRows.slice(featured.length) : mainRows;
  const roleLabel = ROLE_OPTIONS.find((item) => item.id === profile.role)?.label;
  const areaLabel = profile.area === "all" ? "拠点はどこでも" : profile.area;

  const patch = (partial: Partial<Filters>) => setFilters((current) => ({ ...current, ...partial }));
  const applyQuick = (next: "open" | "soon" | "saved") => {
    if (next === "saved") {
      patch(filters.savedOnly ? { savedOnly: false, status: "open" } : { savedOnly: true, status: "all" });
      return;
    }
    if (next === "soon" && quick === "soon") {
      patch({ status: "open", savedOnly: false });
      return;
    }
    patch({ status: next, savedOnly: false });
  };
  const goHome = () => {
    setFilters(DEFAULT_FILTERS);
    setView("cards");
    setSelected(null);
    setFiltersOpen(false);
    setFocusDay(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const setSort = (next: SortKey) => patch({ sortOverride: next });
  const toggleSave = (id: number) =>
    setSaved((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const toggleCategory = (category: (typeof CATEGORIES)[number]) =>
    patch({
      categories: filters.categories.includes(category)
        ? filters.categories.filter((item) => item !== category)
        : [...filters.categories, category],
    });

  return (
    <div className="page">
      <header className="top">
        <div className="brand-block">
          <button type="button" className="brand" aria-label="挑戦ナビの最初の画面に戻る" onClick={goHome}>
            <h1>
              <img src={`${import.meta.env.BASE_URL}logo.png`} alt="挑戦ナビ" />
            </h1>
          </button>
          <p className="tagline">ハッカソン、ビジコン、奨学金から、次に出す一本を探す。</p>
        </div>
        <div className="stats" role="group" aria-label="募集の絞り込み">
          <button type="button" className={quick === "open" ? "is-on" : undefined} aria-pressed={quick === "open"} onClick={() => applyQuick("open")}>
            <strong>
              {openCount}
              <small>件</small>
            </strong>
            <span>まだ間に合う</span>
          </button>
          <button type="button" className={quick === "soon" ? "is-on" : undefined} aria-pressed={quick === "soon"} onClick={() => applyQuick("soon")}>
            <strong>
              {soonCount}
              <small>件</small>
            </strong>
            <span>14日以内</span>
          </button>
          <button type="button" className={quick === "saved" ? "is-on" : undefined} aria-pressed={quick === "saved"} onClick={() => applyQuick("saved")}>
            <strong>
              {savedCount}
              <small>件</small>
            </strong>
            <span>保存した</span>
          </button>
        </div>
      </header>

      <section className="finder">
        <form
          className="search"
          onSubmit={(event) => {
            event.preventDefault();
            document.getElementById("q")?.blur();
          }}
        >
          <label className="sr" htmlFor="q">
            募集を探す
          </label>
          <input
            id="q"
            value={filters.q}
            placeholder="例: はっかそん、とよはし、書類だけのコスパ"
            onChange={(event) => patch({ q: event.target.value, sortOverride: undefined })}
          />
          <button type="submit" className="primary">
            探す
          </button>
        </form>
        <div className="prompts">
          {PROMPTS.map((prompt) => (
            <button
              key={prompt.q}
              type="button"
              className={filters.q === prompt.q ? "chip is-on" : "chip"}
              onClick={() => patch({ q: filters.q === prompt.q ? "" : prompt.q, sortOverride: undefined })}
            >
              {prompt.label}
            </button>
          ))}
        </div>
        {query.notes.length > 0 && (
          <p className="interpret">
            解釈: {query.notes.join(" · ")}
            <button type="button" className="text-btn" onClick={() => patch({ q: "" })}>
              クリア
            </button>
          </p>
        )}
        <details className="profile">
          <summary>あなた向けの条件</summary>
          <div>
            <span className="label">立場</span>
            {ROLE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={profile.role === option.id ? "chip is-on" : "chip"}
                aria-pressed={profile.role === option.id}
                onClick={() => setProfile((current) => ({ ...current, role: option.id }))}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div>
            <span className="label">拠点</span>
            {AREA_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={profile.area === option.id ? "chip is-on" : "chip"}
                aria-pressed={profile.area === option.id}
                onClick={() => setProfile((current) => ({ ...current, area: option.id }))}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div>
            <span className="label">興味</span>
            {TAGS.map((tag) => {
              const on = profile.interests.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  className={on ? "chip is-on" : "chip"}
                  aria-pressed={on}
                  onClick={() =>
                    setProfile((current) => ({
                      ...current,
                      interests: on ? current.interests.filter((item) => item !== tag) : [...current.interests, tag],
                    }))
                  }
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </details>
      </section>

      <div className="layout">
        <aside className={filtersOpen ? "side is-open" : "side"}>
          <div className="side-head">
            <h2>絞り込み</h2>
            <button type="button" className="text-btn close-side" onClick={() => setFiltersOpen(false)}>
              閉じる
            </button>
          </div>
          <FilterGroup label="状態">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={filters.status === option.id ? "chip is-on" : "chip"}
                aria-pressed={filters.status === option.id}
                onClick={() => patch({ status: option.id, savedOnly: false })}
              >
                {option.label}
              </button>
            ))}
          </FilterGroup>
          <FilterGroup label="奨学金">
            {SCHOLARSHIP_CATEGORIES.map((category) => (
              <CategoryChip
                key={category}
                category={category}
                count={counts[category] ?? 0}
                on={filters.categories.includes(category)}
                onToggle={toggleCategory}
              />
            ))}
          </FilterGroup>
          <FilterGroup label="コンペ">
            {CONTEST_CATEGORIES.map((category) => (
              <CategoryChip
                key={category}
                category={category}
                count={counts[category] ?? 0}
                on={filters.categories.includes(category)}
                onToggle={toggleCategory}
              />
            ))}
          </FilterGroup>
          <details className="more">
            <summary>開催条件</summary>
          <FilterGroup label="形式">
            {FORMAT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={filters.format === option.id ? "chip is-on" : "chip"}
                aria-pressed={filters.format === option.id}
                onClick={() => patch({ format: option.id })}
              >
                {option.label}
              </button>
            ))}
          </FilterGroup>
          <FilterGroup label="地域">
            {AREA_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={filters.area === option.id ? "chip is-on" : "chip"}
                aria-pressed={filters.area === option.id}
                onClick={() => patch({ area: option.id })}
              >
                {option.label}
              </button>
            ))}
            <p className="fine">オンライン開催は、地域を選んでも残します。</p>
          </FilterGroup>
          <FilterGroup label="賞金">
            {PRIZE_OPTIONS.map((option) => (
              <button
                key={option.yen}
                type="button"
                className={filters.minPrize === option.yen ? "chip is-on" : "chip"}
                aria-pressed={filters.minPrize === option.yen}
                onClick={() => patch({ minPrize: option.yen })}
              >
                {option.label}
              </button>
            ))}
          </FilterGroup>
          <FilterGroup label="入り方">
            <button
              type="button"
              className={filters.student ? "chip is-on" : "chip"}
              aria-pressed={filters.student}
              onClick={() => patch({ student: !filters.student })}
            >
              学生が対象
            </button>
            <button
              type="button"
              className={filters.universityPlus ? "chip is-on" : "chip"}
              aria-pressed={filters.universityPlus}
              onClick={() => patch({ universityPlus: !filters.universityPlus })}
            >
              大学生以上
            </button>
            <button
              type="button"
              className={filters.docOnly ? "chip is-on" : "chip"}
              aria-pressed={filters.docOnly}
              onClick={() => patch({ docOnly: !filters.docOnly })}
            >
              企画・書類が中心
            </button>
            <button
              type="button"
              className={filters.beginner ? "chip is-on" : "chip"}
              aria-pressed={filters.beginner}
              onClick={() => patch({ beginner: !filters.beginner })}
            >
              初心者歓迎
            </button>
            <button
              type="button"
              className={filters.savedOnly ? "chip is-on" : "chip"}
              aria-pressed={filters.savedOnly}
              onClick={() => patch({ savedOnly: !filters.savedOnly })}
            >
              保存だけ
            </button>
          </FilterGroup>
          </details>
          <button type="button" className="text-btn reset" onClick={() => setFilters(DEFAULT_FILTERS)}>
            条件をリセット
          </button>
        </aside>

        <main>
          <div className="toolbar">
            <p>
              {roleLabel} · {areaLabel}で <strong>{filtered.length}</strong> 件
            </p>
            <div className="toolbar-actions">
              <button type="button" className="ghost filter-toggle" onClick={() => setFiltersOpen(true)}>
                絞り込み
              </button>
              <div className="views" role="tablist" aria-label="表示">
                {(
                  [
                    ["cards", "図鑑"],
                    ["board", "締切"],
                    ["calendar", "暦"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={view === id}
                    className={view === id ? "chip is-on" : "chip"}
                    onClick={() => setView(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {view === "cards" && (
            <div className="sorts">
              {SORTS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={sort === option.id ? "chip is-on" : "chip"}
                  aria-pressed={sort === option.id}
                  onClick={() => setSort(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {!catalog && !loadError && (
            <div className="empty">
              <h3>募集を読み込んでいます</h3>
            </div>
          )}
          {loadError && (
            <div className="empty">
              <h3>{loadError}</h3>
              <p>通信できる状態で、もう一度ページを開いてください。</p>
            </div>
          )}

          {catalog && featured.length > 0 && (
            <section className="featured">
              <h2>おすすめ</h2>
              <div className="stack">
                {featured.map((row) => (
                  <Card
                    key={row.c.id}
                    row={row}
                    saved={saved.includes(row.c.id)}
                    onOpen={setSelected}
                    onToggleSave={toggleSave}
                  />
                ))}
              </div>
            </section>
          )}

          {catalog && view === "cards" && scholarshipRows.length > 0 && (splitScholarships || contestRows.length === 0) && (
            <section className="scholarship">
              <h2 className="section-label">奨学金</h2>
              <p className="fine">学業、留学、スポーツ、芸術、医療・福祉、理工、経済支援に分けています。金額は公開されている総額です。</p>
              {SCHOLARSHIP_CATEGORIES.map((genre) => {
                const rows = scholarshipRows.filter((row) => row.c.category === genre);
                if (!rows.length) return null;
                return (
                  <div className="genre-block" key={genre}>
                    <h3>{genre}</h3>
                    <div className="stack">
                      {rows.map((row) => (
                        <Card
                          key={row.c.id}
                          row={row}
                          saved={saved.includes(row.c.id)}
                          onOpen={setSelected}
                          onToggleSave={toggleSave}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {catalog && view === "cards" && contestRows.length > 0 && (
            <section className="stack">
              {splitScholarships && list.length > 0 && <h2 className="section-label">コンペ・イベント</h2>}
              {!splitScholarships && featured.length > 0 && list.length > 0 && (
                <h2 className="section-label">すべての募集</h2>
              )}
              {list.map((row) => (
                <Card
                  key={row.c.id}
                  row={row}
                  saved={saved.includes(row.c.id)}
                  onOpen={setSelected}
                  onToggleSave={toggleSave}
                />
              ))}
            </section>
          )}
          {catalog && view === "cards" && filtered.length === 0 && <Empty />}
          {catalog && view === "board" && <Board rows={filtered} onOpen={setSelected} />}
          {catalog && view === "calendar" && (
            <Calendar
              rows={filtered}
              today={today}
              cursor={cursor}
              focus={focusDay}
              onCursor={setCursor}
              onFocus={setFocusDay}
              onOpen={setSelected}
            />
          )}
        </main>
      </div>

      <footer className="foot">
        <p>
          {catalog
            ? `${formatUpdated(catalog.updatedAt)}に、${catalog.sources
                .map((source) => (source.ok ? `${source.label} ${source.fetched}件` : `${source.label}は失敗`))
                .join("、")}から取得しました。毎日7:10に自動更新します。`
            : "毎日7:10に、公開サイトから募集を自動更新します。"}
          重複はまとめ、終了した募集は初期状態では隠しています。金額と日程は要約なので、応募前に公式ページを確認してください。
        </p>
      </footer>

      {selectedRow && (
        <Detail
          row={selectedRow}
          saved={saved.includes(selectedRow.c.id)}
          onClose={() => setSelected(null)}
          onToggleSave={toggleSave}
        />
      )}
    </div>
  );
}

function formatUpdated(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "直前";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="group">
      <h3>{label}</h3>
      <div className="chips">{children}</div>
    </section>
  );
}

function CategoryChip({
  category,
  count,
  on,
  onToggle,
}: {
  category: Category;
  count: number;
  on: boolean;
  onToggle: (category: Category) => void;
}) {
  return (
    <button type="button" className={on ? "chip is-on" : "chip"} aria-pressed={on} onClick={() => onToggle(category)}>
      {category}
      <em>{count}</em>
    </button>
  );
}
