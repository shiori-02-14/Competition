import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Board, Calendar, Card, Detail, Empty, ToTop } from "./components";
import {
  AREA_OPTIONS,
  CATEGORIES_BY_KIND,
  DEFAULT_FILTERS,
  FORMAT_OPTIONS,
  KIND_OPTIONS,
  PRIZE_OPTIONS,
  PROMPTS,
  ROLE_OPTIONS,
  SEARCH_PLACEHOLDER,
  SORTS,
  STATUS_OPTIONS,
  TAGS,
  effectiveSort,
  evaluate,
  filtersToSearch,
  formatYen,
  interpret,
  isView,
  loadIds,
  loadProfile,
  matchRow,
  readFilters,
  sortRows,
  switchKind,
  todayISO,
} from "./lib/logic";
import { installSearchIndex, searchGeneration } from "./lib/kana";
import type { Category, Competition, Filters, Kind, Profile, SortKey, StatusFilter, View } from "./lib/types";

const PAGE = 20;

const STATUS_CHIP: Record<StatusFilter, string> = {
  open: "まだ間に合う",
  soon: "14日以内",
  closed: "終了した募集",
  all: "終了も含む",
};

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
  const [nav, setNav] = useState(0);
  const mainRef = useRef<HTMLElement>(null);

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
    return interpret(filters.q, filters.kind);
  }, [filters.q, filters.kind, searchGen]);
  const sort = effectiveSort(filters, query);
  const filtered = useMemo(
    () => sortRows(evaluated.filter((row) => matchRow(row, filters, query, saved)), sort, today),
    [evaluated, filters, query, saved, sort, today],
  );
  const counts = useMemo(() => {
    const base = evaluated.filter((row) => matchRow(row, { ...filters, categories: [] }, query, saved));
    return Object.fromEntries(
      CATEGORIES_BY_KIND[filters.kind].map((cat) => [cat, base.filter((row) => row.c.category === cat).length]),
    );
  }, [evaluated, filters, query, saved]);
  const kindCounts = useMemo(() => {
    const result: Record<Kind, number> = { contest: 0, scholarship: 0 };
    for (const option of KIND_OPTIONS) {
      const next = switchKind(filters, option.id);
      const nextQuery = next === filters ? query : interpret(next.q, option.id);
      result[option.id] = evaluated.filter((row) => matchRow(row, next, nextQuery, saved)).length;
    }
    return result;
  }, [evaluated, filters, query, saved]);

  useEffect(() => {
    void nav;
    const next = filtersToSearch(filters, view, selected);
    const current = `${window.location.pathname}${window.location.search}`;
    const target = `${window.location.pathname}${next}`;
    if (current !== target) window.history.replaceState(window.history.state, "", target);
  }, [filters, view, selected, nav]);

  // history.back() は非同期なので、popstate の前にもう一度閉じるとサイトの外まで戻ってしまう。
  const goingBack = useRef(false);
  const closeLayer = useCallback((layer: "detail" | "filters", fallback: () => void) => {
    if (window.history.state?.layer !== layer) return fallback();
    if (goingBack.current) return;
    goingBack.current = true;
    window.history.back();
  }, []);
  const closeDetail = useCallback(() => closeLayer("detail", () => setSelected(null)), [closeLayer]);
  const closeFilters = useCallback(() => closeLayer("filters", () => setFiltersOpen(false)), [closeLayer]);

  useEffect(() => {
    const onPop = () => {
      goingBack.current = false;
      setSelected(readSelected(window.location.search));
      setFiltersOpen(window.history.state?.layer === "filters");
      setNav((count) => count + 1);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!filtersOpen) return;
    document.body.classList.add("panel-open");
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeFilters();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("panel-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [filtersOpen, closeFilters]);

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
  const featured = browsing && sort === "recommend" ? filtered.slice(0, 3) : [];
  const list = featured.length ? filtered.slice(featured.length) : filtered;
  const scholarshipTab = filters.kind === "scholarship";
  const otherKind = KIND_OPTIONS.find((option) => option.id !== filters.kind) ?? KIND_OPTIONS[0];
  const crossHits = filters.q && switchKind(filters, otherKind.id).q === filters.q ? kindCounts[otherKind.id] : 0;
  const roleLabel = ROLE_OPTIONS.find((item) => item.id === profile.role)?.label;
  const profileLabel = [
    roleLabel,
    profile.area === "all" ? "全国" : profile.area,
    ...profile.interests.slice(0, 3),
  ].join("・");

  const listKey = filtersToSearch(filters, view, null);
  const [paging, setPaging] = useState({ key: listKey, limit: PAGE });
  const limit = paging.key === listKey ? paging.limit : PAGE;
  const visible = list.slice(0, limit);
  const rest = list.length - visible.length;
  const shownKey = useRef(listKey);
  useEffect(() => {
    if (shownKey.current === listKey) return;
    shownKey.current = listKey;
    const main = mainRef.current;
    if (main && main.getBoundingClientRect().top < 0) main.scrollIntoView({ block: "start" });
  }, [listKey]);

  const applied: { id: string; label: string; clear: Partial<Filters> }[] = [];
  if (filters.savedOnly) {
    applied.push({
      id: "saved",
      label: "保存だけ",
      clear: filters.status === "all" ? { savedOnly: false, status: "open" } : { savedOnly: false },
    });
  }
  if (filters.status !== "open" && !(filters.savedOnly && filters.status === "all")) {
    applied.push({ id: "status", label: STATUS_CHIP[filters.status], clear: { status: "open" } });
  }
  for (const category of filters.categories) {
    applied.push({
      id: category,
      label: category,
      clear: { categories: filters.categories.filter((item) => item !== category) },
    });
  }
  if (filters.format !== "all") {
    const label = FORMAT_OPTIONS.find((option) => option.id === filters.format)?.label ?? filters.format;
    applied.push({ id: "format", label, clear: { format: "all" } });
  }
  if (filters.area !== "all") applied.push({ id: "area", label: filters.area, clear: { area: "all" } });
  if (filters.minPrize) {
    const label =
      PRIZE_OPTIONS.find((option) => option.yen === filters.minPrize)?.label ?? `${formatYen(filters.minPrize)}〜`;
    applied.push({ id: "prize", label: `${scholarshipTab ? "金額" : "賞金"}${label}`, clear: { minPrize: 0 } });
  }
  if (filters.student) applied.push({ id: "student", label: "学生が対象", clear: { student: false } });
  if (filters.universityPlus) applied.push({ id: "uni", label: "大学生以上", clear: { universityPlus: false } });
  if (filters.docOnly) applied.push({ id: "doc", label: "企画・書類が中心", clear: { docOnly: false } });
  if (filters.beginner) applied.push({ id: "beginner", label: "初心者歓迎", clear: { beginner: false } });

  const patch = (partial: Partial<Filters>) => setFilters((current) => ({ ...current, ...partial }));
  const resetFilters = () => setFilters({ ...DEFAULT_FILTERS, kind: filters.kind });
  const clearApplied = () =>
    setFilters((current) => ({ ...DEFAULT_FILTERS, kind: current.kind, q: current.q, sortOverride: current.sortOverride }));
  const openDetail = (id: number) => {
    window.history.pushState({ layer: "detail" }, "", `${window.location.pathname}${filtersToSearch(filters, view, id)}`);
    setSelected(id);
  };
  const openFilters = () => {
    window.history.pushState({ layer: "filters" }, "", window.location.href);
    setFiltersOpen(true);
  };
  const setQuery = (q: string) =>
    setFilters((current) => {
      const named = interpret(q, current.kind).kind;
      const base = named && named !== current.kind ? switchKind(current, named) : current;
      return { ...base, q, sortOverride: undefined };
    });
  const changeKind = (next: Kind) => setFilters((current) => switchKind(current, next));
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
  const toggleCategory = (category: Category) =>
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

      <div className="kinds" role="tablist" aria-label="探すもの">
        {KIND_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={filters.kind === option.id}
            className={filters.kind === option.id ? "is-on" : undefined}
            onClick={() => changeKind(option.id)}
          >
            {option.label}
            {catalog && <em>{kindCounts[option.id]}件</em>}
          </button>
        ))}
      </div>

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
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            value={filters.q}
            placeholder={SEARCH_PLACEHOLDER[filters.kind]}
            onChange={(event) => setQuery(event.target.value)}
          />
          {filters.q && (
            <button
              type="button"
              className="clear"
              aria-label="検索語を消す"
              onClick={() => {
                setQuery("");
                document.getElementById("q")?.focus();
              }}
            >
              ×
            </button>
          )}
          <button type="submit" className="primary">
            探す
          </button>
        </form>
        <div className="prompts">
          {PROMPTS[filters.kind].map((prompt) => (
            <button
              key={prompt.q}
              type="button"
              className={filters.q === prompt.q ? "chip is-on" : "chip"}
              onClick={() => setQuery(filters.q === prompt.q ? "" : prompt.q)}
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
          <summary>
            あなた向けの条件<span>{profileLabel}</span>
          </summary>
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
            <button type="button" className="text-btn close-side" onClick={closeFilters}>
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
          <FilterGroup label="ジャンル">
            {CATEGORIES_BY_KIND[filters.kind].map((category) => (
              <CategoryChip
                key={category}
                category={category}
                count={counts[category] ?? 0}
                on={filters.categories.includes(category)}
                onToggle={toggleCategory}
              />
            ))}
          </FilterGroup>
          {!scholarshipTab && (
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
          )}
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
            <p className="fine">
              {scholarshipTab ? "地域の記載がない奨学金は外れます。" : "オンライン開催は、地域を選んでも残します。"}
            </p>
          </FilterGroup>
          <FilterGroup label={scholarshipTab ? "金額" : "賞金"}>
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
            {!scholarshipTab && (
              <button
                type="button"
                className={filters.student ? "chip is-on" : "chip"}
                aria-pressed={filters.student}
                onClick={() => patch({ student: !filters.student })}
              >
                学生が対象
              </button>
            )}
            <button
              type="button"
              className={filters.universityPlus ? "chip is-on" : "chip"}
              aria-pressed={filters.universityPlus}
              onClick={() => patch({ universityPlus: !filters.universityPlus })}
            >
              大学生以上
            </button>
            {!scholarshipTab && (
              <>
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
              </>
            )}
            <button
              type="button"
              className={filters.savedOnly ? "chip is-on" : "chip"}
              aria-pressed={filters.savedOnly}
              onClick={() => patch({ savedOnly: !filters.savedOnly })}
            >
              保存だけ
            </button>
          </FilterGroup>
          <button type="button" className="text-btn reset" onClick={resetFilters}>
            条件をリセット
          </button>
          <div className="side-foot">
            <button type="button" className="text-btn" onClick={resetFilters}>
              リセット
            </button>
            <button type="button" className="apply" onClick={closeFilters}>
              {filtered.length}件を見る
            </button>
          </div>
        </aside>

        <main ref={mainRef}>
          <div className="toolbar">
            <p>
              該当 <strong>{filtered.length}</strong> 件
            </p>
            <div className="toolbar-actions">
              <button type="button" className="ghost filter-toggle" onClick={openFilters}>
                絞り込み
                {applied.length > 0 && <em>{applied.length}</em>}
              </button>
              <div className="views" role="tablist" aria-label="表示">
                {(
                  [
                    ["cards", "一覧"],
                    ["board", "締切"],
                    ["calendar", "カレンダー"],
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
          {applied.length > 0 && (
            <div className="applied" role="group" aria-label="適用中の条件">
              {applied.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="chip is-on"
                  aria-label={`${item.label}を外す`}
                  onClick={() => patch(item.clear)}
                >
                  {item.label}
                  <span aria-hidden="true">×</span>
                </button>
              ))}
              <button type="button" className="text-btn" onClick={clearApplied}>
                すべて解除
              </button>
            </div>
          )}
          {view === "cards" && (
            <div className="sorts">
              {SORTS[filters.kind].map((option) => (
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
                    onOpen={openDetail}
                    onToggleSave={toggleSave}
                  />
                ))}
              </div>
            </section>
          )}

          {catalog && view === "cards" && list.length > 0 && (
            <section className="stack">
              {featured.length > 0 && <h2 className="section-label">すべての{scholarshipTab ? "奨学金" : "募集"}</h2>}
              {visible.map((row) => (
                <Card
                  key={row.c.id}
                  row={row}
                  saved={saved.includes(row.c.id)}
                  onOpen={openDetail}
                  onToggleSave={toggleSave}
                />
              ))}
              {rest > 0 && (
                <button type="button" className="more" onClick={() => setPaging({ key: listKey, limit: limit + PAGE })}>
                  もっと見る（残り{rest}件）
                </button>
              )}
            </section>
          )}
          {catalog && view === "cards" && filtered.length === 0 && (
            filters.savedOnly && saved.length === 0 ? (
              <Empty
                title="保存した募集はまだありません"
                text="気になる募集はカードの「保存」で残せます。あとからここでまとめて見返せます。"
              />
            ) : (
              <Empty>
                {crossHits > 0 && (
                  <button type="button" className="ghost" onClick={() => changeKind(otherKind.id)}>
                    {otherKind.label}なら{crossHits}件あります
                  </button>
                )}
              </Empty>
            )
          )}
          {catalog && view === "board" && <Board key={listKey} rows={filtered} onOpen={openDetail} />}
          {catalog && view === "calendar" && (
            <Calendar
              rows={filtered}
              today={today}
              cursor={cursor}
              focus={focusDay}
              onCursor={setCursor}
              onFocus={setFocusDay}
              onOpen={openDetail}
            />
          )}
        </main>
      </div>
      <ToTop />

      <footer className="foot">
        <p>
          {catalog
            ? `${formatUpdated(catalog.updatedAt)}時点の募集です。毎日7:10に自動更新します。`
            : "毎日7:10に、公開サイトから募集を自動更新します。"}
          重複はまとめ、終了した募集は初期状態では隠しています。金額と日程は要約なので、応募前に公式ページを確認してください。
        </p>
      </footer>

      {selectedRow && (
        <Detail
          row={selectedRow}
          saved={saved.includes(selectedRow.c.id)}
          onClose={closeDetail}
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
