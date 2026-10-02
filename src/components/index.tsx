import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  CATEGORY_SHORT,
  audienceLabel,
  effortLabel,
  eventDate,
  formatDate,
  formatLabel,
  isTravelSupport,
} from "../lib/logic";
import type { Row } from "../lib/logic";
import type { Competition } from "../lib/types";

function Thumb({ item }: { item: Competition }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="thumb" aria-hidden="true">
      {item.image && !failed ? (
        <img
          src={item.image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{CATEGORY_SHORT[item.category]}</span>
      )}
    </div>
  );
}

export function Card({
  row,
  saved,
  onOpen,
  onToggleSave,
}: {
  row: Row;
  saved: boolean;
  onOpen: (id: number) => void;
  onToggleSave: (id: number) => void;
}) {
  const { c, ev } = row;
  const closed = ev.status === "closed";
  return (
    <article
      className={closed ? "card is-closed" : "card"}
      data-cat={c.category}
      onClick={() => {
        if (window.getSelection()?.toString()) return;
        onOpen(c.id);
      }}
    >
      <div className="card-body">
        <div className="card-top">
          <div className="title-line">
            {ev.status === "soon" && <span className="pill">{ev.whenLabel}</span>}
            {closed && <span className="pill is-ended">募集終了</span>}
            <h3>
              <button
                type="button"
                className="title-btn"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpen(c.id);
                }}
              >
                {c.title}
              </button>
            </h3>
          </div>
          <div className="card-actions">
            <button
              type="button"
              className={saved ? "text-btn is-on" : "text-btn"}
              aria-pressed={saved}
              onClick={(event) => {
                event.stopPropagation();
                onToggleSave(c.id);
              }}
            >
              {saved ? "保存済み" : "保存"}
            </button>
          </div>
        </div>
        <div className="comment">
          <span>一言コメント</span>
          <p>{leadLine(c.summary, ev.fitReasons[0])}</p>
        </div>
        <div className="entry-main">
          <dl className="facts">
            <div>
              <dt>{isTravelSupport(c) ? "交通費" : "賞"}</dt>
              <dd>{ev.prizeLabel}</dd>
            </div>
            <div>
              <dt>主催</dt>
              <dd>{c.organizer || "記載なし"}</dd>
            </div>
            <div>
              <dt className="is-due">締切</dt>
              <dd className="is-due">{ev.deadlineLabel}</dd>
            </div>
            <div>
              <dt>開催日</dt>
              <dd>{ev.startLabel}</dd>
            </div>
          </dl>
          <Thumb item={c} />
        </div>
      </div>
    </article>
  );
}

function leadLine(summary: string, fallback: string) {
  const text = summary.replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  const sentence = text.split("。")[0];
  return sentence.length > 48 ? `${sentence.slice(0, 48)}…` : sentence;
}

export function Detail({
  row,
  saved,
  onClose,
  onToggleSave,
}: {
  row: Row;
  saved: boolean;
  onClose: () => void;
  onToggleSave: (id: number) => void;
}) {
  const { c, ev } = row;
  useEffect(() => {
    document.body.classList.add("drawer-open");
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("drawer-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="drawer-root">
      <button type="button" className="backdrop" aria-label="詳細を閉じる" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div className="drawer-bar">
          <span className={ev.status === "closed" ? "when" : "when is-hot"}>{ev.whenLabel}</span>
          <button type="button" className="text-btn" onClick={onClose}>
            閉じる
          </button>
        </div>
        <p className="kicker">{c.category}</p>
        <h2 id="detail-title">{c.title}</h2>
        <p className="org">{c.organizer || "主催の記載なし"}</p>
        <div className="drawer-cta">
          <a className="primary" href={c.url} target="_blank" rel="noreferrer">
            公式ページで確認
          </a>
          <button type="button" className="ghost" aria-pressed={saved} onClick={() => onToggleSave(c.id)}>
            {saved ? "保存済み" : "保存する"}
          </button>
        </div>
        <div className="meters">
          <Meter label="相性" value={ev.fit} note={ev.fitReasons.join("。")} />
          <Meter label="コスパ" value={ev.cospa} note={ev.cospaReasons.join("。")} />
          <Meter label="挑戦度" value={ev.challenge} note={`${ev.challengeLabel}。${ev.challengeNote}`} />
        </div>
        <details className="howto">
          <summary>この数字の意味</summary>
          <p>相性は、学年・拠点・興味との近さです。</p>
          <p>コスパは、賞金額に対して手間と移動が小さいかを見ています。企画書やオンラインは上がります。</p>
          <p>挑戦度は、賞金額、主催の規模、実装の重さから見た通りにくさです。高いほど勝ちにくい、という意味です。</p>
        </details>
        <dl className="detail-facts">
          <div>
            <dt>締切</dt>
            <dd>{ev.deadlineLabel}</dd>
          </div>
          <div>
            <dt>開催日</dt>
            <dd>{ev.startLabel}</dd>
          </div>
          <div>
            <dt>会場</dt>
            <dd>{c.venue || "記載なし"}</dd>
          </div>
          <div>
            <dt>形式</dt>
            <dd>{formatLabel(c.format)}</dd>
          </div>
          <div>
            <dt>対象</dt>
            <dd>{audienceLabel(c.audience)}</dd>
          </div>
          <div>
            <dt>手間</dt>
            <dd>{effortLabel(c.effort)}</dd>
          </div>
          <div>
            <dt>{isTravelSupport(c) ? "交通費" : "賞金"}</dt>
            <dd>{isTravelSupport(c) ? ev.prizeLabel : c.prize || ev.prizeLabel}</dd>
          </div>
        </dl>
        {c.tags.length > 0 && (
          <div className="badges">
            {c.tags.map((tag) => (
              <span className="badge" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        )}
        {c.summary && <p className="detail-summary">{c.summary}</p>}
        <p className="fine">金額と日程は公開情報の要約です。応募前に公式ページで要項を確認してください。</p>
      </aside>
    </div>,
    document.body,
  );
}

function Meter({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="meter">
      <div className="meter-top">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="track">
        <span style={{ width: `${value}%` }} />
      </div>
      <p>{note}</p>
    </div>
  );
}

export function Board({
  rows,
  onOpen,
}: {
  rows: Row[];
  onOpen: (id: number) => void;
}) {
  const columns = [
    { id: "soon", title: "14日以内", rows: rows.filter((row) => row.ev.status === "soon") },
    {
      id: "month",
      title: "15〜45日",
      rows: rows.filter((row) => row.ev.status === "open" && row.ev.days !== null && row.ev.days <= 45),
    },
    {
      id: "later",
      title: "それ以降",
      rows: rows.filter((row) => row.ev.status === "open" && (row.ev.days === null || row.ev.days > 45)),
    },
    { id: "unknown", title: "日程を確認", rows: rows.filter((row) => row.ev.status === "unknown") },
    { id: "closed", title: "終了", rows: rows.filter((row) => row.ev.status === "closed") },
  ].filter((column) => column.rows.length > 0);

  if (!columns.length) return <Empty />;
  return (
    <div className="board">
      {columns.map((column) => (
        <section key={column.id} className="column">
          <header>
            <h3>{column.title}</h3>
            <span>{column.rows.length}</span>
          </header>
          {column.rows.map((row) => (
            <button key={row.c.id} type="button" className="mini" data-cat={row.c.category} onClick={() => onOpen(row.c.id)}>
              <span>{row.c.category}</span>
              <strong>{row.c.title}</strong>
              <em>締切 {row.ev.deadlineLabel}</em>
              <em>開催 {row.ev.startLabel}</em>
              <small>{row.ev.prizeLabel}</small>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}

export function Calendar({
  rows,
  today,
  cursor,
  focus,
  onCursor,
  onFocus,
  onOpen,
}: {
  rows: Row[];
  today: string;
  cursor: { year: number; month: number };
  focus: string | null;
  onCursor: (cursor: { year: number; month: number }) => void;
  onFocus: (iso: string | null) => void;
  onOpen: (id: number) => void;
}) {
  const cells = buildCells(cursor.year, cursor.month);
  const byDay = new Map<string, { row: Row; kind: string }[]>();
  const mark = (iso: string, row: Row, kind: string) => {
    if (!iso) return;
    const list = byDay.get(iso) ?? [];
    const existing = list.find((item) => item.row.c.id === row.c.id);
    if (existing) {
      if (existing.kind !== kind) existing.kind = "締切・開催";
    } else {
      list.push({ row, kind });
      byDay.set(iso, list);
    }
  };
  for (const row of rows) {
    mark(row.c.deadline, row, "締切");
    mark(eventDate(row.c), row, "開催");
  }
  const focused = focus ? byDay.get(focus) ?? [] : [];
  const shift = (delta: number) => {
    const date = new Date(cursor.year, cursor.month + delta, 1);
    onCursor({ year: date.getFullYear(), month: date.getMonth() });
    onFocus(null);
  };

  return (
    <div className="calendar">
      <div className="cal-bar">
        <button type="button" className="ghost" onClick={() => shift(-1)}>
          前の月
        </button>
        <h3>
          {cursor.year}年{cursor.month + 1}月
        </h3>
        <button type="button" className="ghost" onClick={() => shift(1)}>
          次の月
        </button>
      </div>
      <div className="cal-grid">
        {["月", "火", "水", "木", "金", "土", "日"].map((label) => (
          <div key={label} className="dow">
            {label}
          </div>
        ))}
        {cells.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} className="day is-empty" />;
          const iso = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const items = byDay.get(iso) ?? [];
          return (
            <button
              key={iso}
              type="button"
              className={["day", iso === today ? "is-today" : "", focus === iso ? "is-focus" : ""].filter(Boolean).join(" ")}
              onClick={() => onFocus(focus === iso ? null : iso)}
            >
              <span className="num">{day}</span>
              {items.length > 0 && <span className="dot">{items.length}</span>}
              <span className="names">
                {items.slice(0, 2).map((item) => (
                  <i key={item.row.c.id}>
                    {item.kind} {item.row.c.title}
                  </i>
                ))}
              </span>
            </button>
          );
        })}
      </div>
      {focus && (
        <div className="day-list">
          <h3>{formatDate(focus, today)}</h3>
          {focused.length === 0 && <p className="fine">この日の締切・開催はありません。</p>}
          {focused.map((item) => (
            <button key={`${item.row.c.id}-${item.kind}`} type="button" className="mini wide" onClick={() => onOpen(item.row.c.id)}>
              <span>{item.kind}</span>
              <strong>{item.row.c.title}</strong>
              <small>
                締切 {item.row.ev.deadlineLabel} / 開催 {item.row.ev.startLabel}
              </small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function buildCells(year: number, month: number): Array<number | null> {
  const first = new Date(year, month, 1);
  const pad = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = Array.from({ length: pad }, () => null);
  for (let day = 1; day <= days; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function Empty() {
  return (
    <div className="empty">
      <h3>条件に合う募集がありません</h3>
      <p>賞金や地域の条件を緩めるか、「終了」を含めて探してみてください。</p>
    </div>
  );
}
