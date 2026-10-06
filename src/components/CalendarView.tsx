import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { CaptureItem } from "../types";
import { dayKey } from "../lib/dates";
import { celebrate } from "../lib/feedback";
import { FRAME } from "../lib/teoSprites";
import TeoSprite from "./TeoSprite";
import { ScreenHeader } from "./ui";

type CalendarEntry = CaptureItem & { sourceId?: string; isSubtask?: boolean };

function expandCalendarItems(items: CaptureItem[]): CalendarEntry[] {
  return items.flatMap((item) => {
    if (item.type === "note") return [];
    const children: CalendarEntry[] =
      item.type === "todo"
        ? (item.subtasks || []).map((subtask) => ({
            ...item,
            id: subtask.id,
            sourceId: item.id,
            isSubtask: true,
            type: "task" as const,
            title: subtask.title,
            content: subtask.content || "",
            startDate: subtask.startDate || item.startDate,
            dueDate: subtask.dueDate || null,
            completed: subtask.completed,
          }))
        : [];
    return [item, ...children];
  });
}

function includesDate(item: CalendarEntry, date: string) {
  const end = item.dueDate || item.startDate;
  return Boolean(item.startDate) && item.startDate <= date && date <= end;
}

function formatDateHeading(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

const TYPE_LABEL = { todo: "To Do", task: "Task", note: "Note" } as const;
const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

/** "2026-10-05" → "10/5", the same short form the list cards use. */
const shortDate = (date: string) => {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
};
const periodLabel = (item: CalendarEntry) =>
  item.dueDate && item.dueDate !== item.startDate ? ` · ${shortDate(item.startDate)} → ${shortDate(item.dueDate)}` : "";
// How many bars fit under a day number before "+n": a roomy screen (a Fold opened up) shows one more.
const COMPACT_LANES = 3;
const WIDE_LANES = 4;
const WIDE_QUERY = "(min-width: 680px)";
const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function useWide() {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(WIDE_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(WIDE_QUERY);
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
}

const shiftDay = (key: string, delta: number) => {
  const date = new Date(`${key}T00:00:00`);
  date.setDate(date.getDate() + delta);
  return dayKey(date);
};
const shiftMonth = (key: string, delta: number) => {
  const date = new Date(`${key}T00:00:00`);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + delta);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, last));
  return dayKey(date);
};

type Bar = { entry: CalendarEntry; col: number; span: number; lane: number; head: boolean; tail: boolean };
type Week = { days: Date[]; bars: Bar[]; hidden: number[]; lanes: number };

/** Lays each item across the weeks it covers as one continuous bar; items without a due date become dots. */
function layoutWeeks(days: Date[], entries: CalendarEntry[], maxLanes: number): Week[] {
  const weeks: Week[] = [];
  for (let w = 0; w * 7 < days.length; w++) {
    const weekDays = days.slice(w * 7, w * 7 + 7);
    const keys = weekDays.map(dayKey);
    const first = keys[0];
    const last = keys[6];
    const segments = entries
      .filter((entry) => entry.startDate && entry.startDate <= last && (entry.dueDate || entry.startDate) >= first)
      .map((entry) => {
        const end = entry.dueDate || entry.startDate;
        const col = Math.max(0, keys.findIndex((k) => k >= entry.startDate));
        const lastCol = keys.length - 1 - [...keys].reverse().findIndex((k) => k <= end);
        return { entry, col, span: lastCol - col + 1, head: entry.startDate >= first, tail: end <= last };
      })
      .sort(
        (a, b) =>
          a.col - b.col ||
          b.span - a.span ||
          a.entry.type.localeCompare(b.entry.type) ||
          a.entry.title.localeCompare(b.entry.title),
      );
    const laneEnds: number[] = [];
    const hidden = new Array<number>(7).fill(0);
    const bars: Bar[] = [];
    for (const seg of segments) {
      let lane = laneEnds.findIndex((end) => end < seg.col);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(seg.col + seg.span - 1);
      } else laneEnds[lane] = seg.col + seg.span - 1;
      if (lane >= maxLanes) for (let c = seg.col; c < seg.col + seg.span; c++) hidden[c]++;
      else bars.push({ ...seg, lane });
    }
    // A week is only as tall as the lanes it uses (at least one, so a day stays easy to tap).
    const lanes = Math.max(1, ...bars.map((bar) => bar.lane + 1));
    weeks.push({ days: weekDays, bars, hidden, lanes });
  }
  return weeks;
}

export default function CalendarView({
  items,
  onClose,
  onSelect,
  onSave,
  onOpenNotes,
  origin,
  quiet,
}: {
  items: CaptureItem[];
  onClose: () => void;
  onSelect: (i: CaptureItem) => void;
  onSave: (i: CaptureItem) => Promise<boolean>;
  onOpenNotes: () => void;
  origin: string;
  quiet: boolean;
}) {
  const today = dayKey(new Date());
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  // The list under the month follows the chosen day; "전체 보기" widens it to everything.
  const [scope, setScope] = useState<"date" | "all">("date");
  const [viewMode, setViewMode] = useState<"day" | "timeline">("day");
  const [completing, setCompleting] = useState<string[]>([]);

  const calendarItems = useMemo(() => expandCalendarItems(items), [items]);
  const notes = useMemo(() => items.filter((item) => item.type === "note"), [items]);
  const todos = useMemo(() => items.filter((item) => item.type === "todo"), [items]);
  const tasks = useMemo(() => calendarItems.filter((item) => item.type === "task"), [calendarItems]);

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const lead = (first.getDay() + 6) % 7;
    const inMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    first.setDate(first.getDate() - lead);
    // Only the weeks that touch this month: a fully-next-month last row would just push the list down.
    return Array.from({ length: Math.ceil((lead + inMonth) / 7) * 7 }, (_, index) => {
      const date = new Date(first);
      date.setDate(first.getDate() + index);
      return date;
    });
  }, [month]);
  const wide = useWide();
  const weeks = useMemo(
    () => layoutWeeks(days, calendarItems, wide ? WIDE_LANES : COMPACT_LANES),
    [days, calendarItems, wide],
  );
  // Every shown day knows how many items it holds, so a screen reader can say so without opening it.
  const dayCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const keys = days.map(dayKey);
    const first = keys[0];
    const last = keys[keys.length - 1];
    for (const entry of calendarItems) {
      if (!entry.startDate) continue;
      const end = entry.dueDate || entry.startDate;
      if (entry.startDate > last || end < first) continue;
      for (const key of keys) if (entry.startDate <= key && key <= end) counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [days, calendarItems]);
  // Roving focus: Tab stops on one day (the chosen one when it is on screen) and the arrow keys move between days.
  const shownKeys = useMemo(() => new Set(days.map(dayKey)), [days]);
  const monthStartKey = dayKey(new Date(month.getFullYear(), month.getMonth(), 1));
  const focusKey = shownKeys.has(selectedDate) ? selectedDate : shownKeys.has(today) ? today : monthStartKey;
  const gridRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    const key = pendingFocus.current;
    if (!key) return;
    pendingFocus.current = null;
    gridRef.current?.querySelector<HTMLElement>(`.cm-day[data-date="${key}"]`)?.focus();
  }, [selectedDate, month]);

  const chooseDay = (key: string, moveFocus = false) => {
    setSelectedDate(key);
    setScope("date");
    // A day outside the weeks on screen brings its month along.
    if (!shownKeys.has(key)) {
      const target = new Date(`${key}T00:00:00`);
      setMonth(new Date(target.getFullYear(), target.getMonth(), 1));
    }
    if (!moveFocus) return;
    const cell = gridRef.current?.querySelector<HTMLElement>(`.cm-day[data-date="${key}"]`);
    if (cell) cell.focus();
    else pendingFocus.current = key; // its month is not drawn yet
  };
  const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const cell = (event.target as HTMLElement).closest<HTMLElement>(".cm-day");
    const key = cell?.dataset.date;
    if (!key) return;
    const weekday = (new Date(`${key}T00:00:00`).getDay() + 6) % 7; // 0 = Monday
    const moves: Record<string, string> = {
      ArrowLeft: shiftDay(key, -1),
      ArrowRight: shiftDay(key, 1),
      ArrowUp: shiftDay(key, -7),
      ArrowDown: shiftDay(key, 7),
      Home: shiftDay(key, -weekday),
      End: shiftDay(key, 6 - weekday),
      PageUp: shiftMonth(key, -1),
      PageDown: shiftMonth(key, 1),
    };
    const next = moves[event.key];
    if (!next) return;
    event.preventDefault();
    chooseDay(next, true);
  };

  const panelColumns = useMemo(
    () =>
      [
        {
          key: "todo" as const,
          label: "To Do",
          items: todos.filter((item) => !(scope === "date" && !includesDate(item, selectedDate)) && !item.completed),
        },
        { key: "task" as const, label: "Task", items: tasks.filter((item) => scope === "all" || includesDate(item, selectedDate)) },
        { key: "note" as const, label: "Note", items: notes.filter((item) => scope === "all" || includesDate(item, selectedDate)) },
      ].map((column) => ({
        ...column,
        items: [...column.items].sort((a, b) => `${a.startDate}-${a.title}`.localeCompare(`${b.startDate}-${b.title}`)),
      })),
    [notes, scope, selectedDate, tasks, todos],
  );

  const timelineGroups = useMemo(() => {
    const monthStart = dayKey(new Date(month.getFullYear(), month.getMonth(), 1));
    const monthEnd = dayKey(new Date(month.getFullYear(), month.getMonth() + 1, 0));
    const entries = [...calendarItems, ...notes].filter((item) => {
      if (!item.startDate) return false;
      const end = item.dueDate || item.startDate;
      return item.startDate <= monthEnd && end >= monthStart;
    });
    const grouped = new Map<string, CalendarEntry[]>();
    entries.forEach((item) => {
      const key = item.startDate;
      const current = grouped.get(key) || [];
      if (!current.some((entry) => entry.id === item.id)) current.push(item);
      grouped.set(key, current);
    });
    return [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, groupedItems]) => ({
        date,
        items: groupedItems.sort((a, b) => `${a.type}-${a.title}`.localeCompare(`${b.type}-${b.title}`)),
      }));
  }, [calendarItems, month, notes]);

  const sourceFor = (entry: CalendarEntry) => (entry.sourceId ? items.find((item) => item.id === entry.sourceId) : entry);

  async function toggleCompleted(entry: CalendarEntry, completed: boolean, box?: Element) {
    const parent = sourceFor(entry);
    if (!parent) return;
    setCompleting((current) => [...current, entry.id]);
    const updated: CaptureItem = entry.isSubtask
      ? {
          ...parent,
          subtasks: (parent.subtasks || []).map((subtask) => (subtask.id === entry.id ? { ...subtask, completed } : subtask)),
        }
      : { ...parent, completed };
    const saved = await onSave(updated);
    if (!saved) {
      setCompleting((current) => current.filter((id) => id !== entry.id));
      return;
    }
    if (completed && box) celebrate(box);
    window.setTimeout(() => setCompleting((current) => current.filter((id) => id !== entry.id)), 320);
  }

  const renderColumnItems = (column: (typeof panelColumns)[number]) => {
    if (!column.items.length) {
      return (
        <div className="calendar-information-empty">
          <TeoSprite cell={FRAME.napping} size={72} />
          <p>{scope === "date" ? "이 날은 비어 있어요" : "아직 없어요"}</p>
          <small>{scope === "date" ? "다른 날짜를 눌러 보세요." : "홈에서 메모지를 던져 보세요."}</small>
        </div>
      );
    }
    const groups =
      scope === "all"
        ? [
            ...column.items.reduce((map, item) => {
              const key = item.startDate || "no-date";
              const group = map.get(key) || [];
              group.push(item);
              map.set(key, group);
              return map;
            }, new Map<string, CalendarEntry[]>()),
          ].sort(([a], [b]) => a.localeCompare(b))
        : [["", column.items] as [string, CalendarEntry[]]];
    return groups.flatMap(([date, groupedItems]) => [
      date && date !== "no-date" ? (
        <div className="calendar-information-date-heading" key={`date-${column.key}-${date}`}>
          {formatDateHeading(date)}
        </div>
      ) : null,
      ...groupedItems.map((item) => {
        const parent = sourceFor(item);
        const isCompleting = completing.includes(item.id);
        return (
          <article
            key={item.id}
            className={`calendar-information-card tone-${item.type} ${item.completed ? "is-completed" : ""} ${isCompleting ? "is-completing" : ""}`}
          >
            {item.type !== "note" && (
              <input
                type="checkbox"
                checked={item.completed}
                onChange={(event) => void toggleCompleted(item, event.target.checked, event.currentTarget)}
                aria-label={`${item.title} 완료`}
              />
            )}
            <button type="button" className="calendar-information-open" onClick={() => parent && onSelect(parent)}>
              <strong>{item.title}</strong>
              {item.content.trim() && <span>{item.content}</span>}
              <small>
                {TYPE_LABEL[item.type]}
                {periodLabel(item)}
              </small>
            </button>
          </article>
        );
      }),
    ]);
  };

  const monthLabel = month.toLocaleDateString("ko-KR", { year: "numeric", month: "long" });
  const selectedLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
  const moveMonth = (offset: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1));

  return (
    <motion.section
      className="panel tc-screen calendar-screen tone-calendar"
      initial={{ clipPath: `circle(20px at ${origin})`, opacity: 0.5 }}
      animate={{ clipPath: `circle(150% at ${origin})`, opacity: 1 }}
      exit={{ clipPath: `circle(20px at ${origin})`, opacity: 0, pointerEvents: "none" as const }}
      transition={{ duration: quiet ? 0.1 : 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <ScreenHeader
        title={monthLabel}
        subtitle="To Do와 Task를 한눈에 봐요"
        tone="calendar"
        backLabel="캘린더 닫기"
        onBack={onClose}
      />

      <div className="cal-toolbar">
        <div className="cal-nav">
          <button type="button" aria-label="이전 달" onClick={() => moveMonth(-1)}>
            ‹
          </button>
          <button
            type="button"
            className="cal-today"
            onClick={() => {
              const now = new Date();
              setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
              setSelectedDate(today);
              setScope("date");
            }}
          >
            Today
          </button>
          <button type="button" aria-label="다음 달" onClick={() => moveMonth(1)}>
            ›
          </button>
        </div>
        <div className="cal-switch" role="group" aria-label="캘린더 보기 방식">
          <button type="button" className={viewMode === "day" ? "is-active" : ""} onClick={() => setViewMode("day")}>
            달력
          </button>
          <button type="button" className={viewMode === "timeline" ? "is-active" : ""} onClick={() => setViewMode("timeline")}>
            리스트
          </button>
        </div>
      </div>

      <div className="calendar-split-layout">
        <section className="calendar-month-panel tc-card" aria-label={`${monthLabel} 월간 캘린더`}>
          <div className="cm-weekdays" aria-hidden="true">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="cm-grid" ref={gridRef} role="group" aria-label="날짜 선택. 화살표 키로 이동" onKeyDown={onGridKeyDown}>
            {weeks.map((week) => (
              <div className="cm-week" key={dayKey(week.days[0])} style={{ "--lanes": week.lanes, "--more": week.hidden.some((count) => count > 0) ? "15px" : "0px" } as CSSProperties}>
                {week.days.map((date, col) => {
                  const key = dayKey(date);
                  return (
                    <button
                      type="button"
                      key={key}
                      data-date={key}
                      className={`cm-day ${date.getMonth() !== month.getMonth() ? "is-outside" : ""} ${key === today ? "is-today" : ""} ${selectedDate === key ? "is-selected" : ""}`}
                      style={{ gridColumn: col + 1 }}
                      tabIndex={key === focusKey ? 0 : -1}
                      aria-pressed={selectedDate === key}
                      aria-current={key === today ? "date" : undefined}
                      onClick={() => chooseDay(key)}
                      aria-label={`${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${DAY_NAMES[date.getDay()]}요일${key === today ? ", 오늘" : ""}, ${dayCounts.get(key) ? `일정 ${dayCounts.get(key)}개` : "일정 없음"}`}
                    >
                      <span className="cm-num">{date.getDate()}</span>
                    </button>
                  );
                })}
                {week.hidden.map((count, col) =>
                  count > 0 ? (
                    <span className="cm-more" key={`more-${col}`} style={{ gridColumn: col + 1, gridRow: week.lanes + 2 }} aria-hidden="true">
                      +{count}
                    </span>
                  ) : null,
                )}
                {week.bars.map((bar) => (
                  <button
                    type="button"
                    key={`${bar.entry.id}-${bar.col}`}
                    className={`calendar-bar cm-bar tone-${bar.entry.type} ${bar.entry.dueDate ? "" : "is-dot"} ${bar.head ? "is-head" : ""} ${bar.tail ? "is-tail" : ""} ${bar.entry.completed ? "is-completed" : ""}`}
                    style={{ gridColumn: `${bar.col + 1} / span ${bar.span}`, gridRow: bar.lane + 2 }}
                    onClick={() => {
                      const parent = sourceFor(bar.entry);
                      if (parent) onSelect(parent);
                    }}
                    title={bar.entry.title}
                    aria-label={`${TYPE_LABEL[bar.entry.type]} ${bar.entry.title}, ${
                      bar.entry.dueDate && bar.entry.dueDate !== bar.entry.startDate
                        ? `${shortDate(bar.entry.startDate)}부터 ${shortDate(bar.entry.dueDate)}까지`
                        : shortDate(bar.entry.startDate)
                    }${bar.entry.completed ? ", 완료" : ""}`}
                  >
                    <span>{bar.entry.title}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
          <p className="calendar-legend">
            <span>
              <i className="todo-dot" /> To Do
            </span>
            <span>
              <i className="task-dot" /> Task
            </span>
            <span>기간은 이어진 막대, 마감이 없으면 점</span>
          </p>
        </section>

        {viewMode === "day" ? (
          <aside className="calendar-information-panel tc-card" aria-label="To Do, Task, Note 정보">
            <div className="calendar-information-heading">
              <div>
                <span className="calendar-kicker">{scope === "date" ? "선택한 날" : "전체"}</span>
                <h2 aria-live="polite">{scope === "date" ? selectedLabel : "전체 목록"}</h2>
              </div>
              <button className="tc-soft-btn" onClick={() => setScope((current) => (current === "date" ? "all" : "date"))}>
                {scope === "date" ? "전체 보기" : "선택일 보기"}
              </button>
            </div>
            <div className="calendar-information-columns">
              {panelColumns.map((column) => (
                <section className={`calendar-information-column tone-${column.key} ${column.key}`} key={column.key} aria-labelledby={`calendar-column-${column.key}`}>
                  <header>
                    <h3 id={`calendar-column-${column.key}`}>{column.label}</h3>
                    <span>{column.items.length}</span>
                  </header>
                  <div className="calendar-information-list">{renderColumnItems(column)}</div>
                </section>
              ))}
            </div>
          </aside>
        ) : (
          <aside className="calendar-timeline-panel tc-card" aria-label="월간 리스트">
            <div className="calendar-information-heading">
              <div>
                <span className="calendar-kicker">이번 달</span>
                <h2>{monthLabel}</h2>
              </div>
              <button className="tc-soft-btn" onClick={onOpenNotes}>
                노트 목록
              </button>
            </div>
            <div className="calendar-timeline-list">
              {timelineGroups.length ? (
                timelineGroups.map((group) => (
                  <section className="calendar-timeline-day" key={group.date}>
                    <h3>{formatDateHeading(group.date)}</h3>
                    {group.items.map((item) => {
                      const parent = sourceFor(item);
                      const isCompleting = completing.includes(item.id);
                      return (
                        <article
                          className={`calendar-timeline-row tone-${item.type} ${item.completed ? "is-completed" : ""} ${isCompleting ? "is-completing" : ""}`}
                          key={`${group.date}-${item.id}`}
                        >
                          {item.type !== "note" ? (
                            <input
                              type="checkbox"
                              checked={item.completed}
                              onChange={(event) => void toggleCompleted(item, event.target.checked, event.currentTarget)}
                              aria-label={`${item.title} 완료`}
                            />
                          ) : (
                            <i className="timeline-dot" aria-hidden="true" />
                          )}
                          <button type="button" className="calendar-timeline-open" onClick={() => parent && onSelect(parent)}>
                            <strong>{item.title}</strong>
                            <small>
                              {TYPE_LABEL[item.type]}
                              {periodLabel(item)}
                            </small>
                          </button>
                        </article>
                      );
                    })}
                  </section>
                ))
              ) : (
                <div className="calendar-information-empty">
                  <TeoSprite cell={FRAME.napping} size={72} />
                  <p>기록이 없어요</p>
                  <small>이 달에 날짜가 있는 항목을 추가해 보세요.</small>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </motion.section>
  );
}
