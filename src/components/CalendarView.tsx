import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { CaptureItem } from "../types";
import { dayKey } from "../lib/dates";

type CalendarEntry = CaptureItem & { sourceId?: string; isSubtask?: boolean };
type PanelFilter = "todo" | "task" | "note";

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

function titleSize(title: string) {
  if (title.length > 34) return 14;
  if (title.length > 22) return 16;
  return 18;
}

export default function CalendarView({
  items,
  onClose,
  onSelect,
  onSave,
  origin,
  quiet,
}: {
  items: CaptureItem[];
  onClose: () => void;
  onSelect: (i: CaptureItem) => void;
  onSave: (i: CaptureItem) => Promise<boolean>;
  origin: string;
  quiet: boolean;
}) {
  const today = dayKey(new Date());
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [filter, setFilter] = useState<PanelFilter>("todo");
  const [scope, setScope] = useState<"date" | "all">("date");
  const [completing, setCompleting] = useState<string[]>([]);

  const calendarItems = useMemo(() => expandCalendarItems(items), [items]);
  const notes = useMemo(() => items.filter((item) => item.type === "note"), [items]);
  const todos = useMemo(() => items.filter((item) => item.type === "todo"), [items]);
  const tasks = useMemo(() => calendarItems.filter((item) => item.type === "task"), [calendarItems]);

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(first);
      date.setDate(first.getDate() + index);
      return date;
    });
  }, [month]);

  const panelItems = useMemo(() => {
    const source: CalendarEntry[] = filter === "todo" ? todos : filter === "task" ? tasks : notes;
    return source
      .filter((item) => scope === "all" || includesDate(item, selectedDate))
      .filter((item) => !(filter === "todo" && item.completed))
      .sort((a, b) => `${a.startDate}-${a.title}`.localeCompare(`${b.startDate}-${b.title}`));
  }, [filter, notes, scope, selectedDate, tasks, todos]);

  const sourceFor = (entry: CalendarEntry) =>
    entry.sourceId ? items.find((item) => item.id === entry.sourceId) : entry;

  async function toggleCompleted(entry: CalendarEntry, completed: boolean) {
    const parent = sourceFor(entry);
    if (!parent) return;
    setCompleting((current) => [...current, entry.id]);
    const updated: CaptureItem = entry.isSubtask
      ? {
          ...parent,
          subtasks: (parent.subtasks || []).map((subtask) =>
            subtask.id === entry.id ? { ...subtask, completed } : subtask,
          ),
        }
      : { ...parent, completed };
    const saved = await onSave(updated);
    if (!saved) {
      setCompleting((current) => current.filter((id) => id !== entry.id));
      return;
    }
    window.setTimeout(
      () => setCompleting((current) => current.filter((id) => id !== entry.id)),
      320,
    );
  }

  const monthLabel = month.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const selectedLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const moveMonth = (offset: number) =>
    setMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1));

  return (
    <motion.section
      className="panel calendar-screen calendar-split-screen"
      initial={{ clipPath: `circle(20px at ${origin})`, opacity: 0.5 }}
      animate={{ clipPath: `circle(150% at ${origin})`, opacity: 1 }}
      exit={{ clipPath: `circle(20px at ${origin})`, opacity: 0 }}
      transition={{ duration: quiet ? 0.1 : 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <header className="calendar-screen-header">
        <button aria-label="캘린더 닫기" onClick={onClose}>←</button>
        <div>
          <span className="calendar-kicker">TEO · CALENDAR</span>
          <h1>{monthLabel}</h1>
        </div>
        <div className="calendar-month-actions">
          <button aria-label="이전 달" onClick={() => moveMonth(-1)}>‹</button>
          <button
            className="calendar-today-button"
            onClick={() => {
              const now = new Date();
              setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
              setSelectedDate(today);
              setScope("date");
            }}
          >Today</button>
          <button aria-label="다음 달" onClick={() => moveMonth(1)}>›</button>
        </div>
      </header>

      <div className="calendar-split-layout">
        <section className="calendar-month-panel" aria-label={`${monthLabel} 월간 캘린더`}>
          <div className="calendar-weekday-row" aria-hidden="true">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="calendar-month-grid">
            {days.map((date) => {
              const key = dayKey(date);
              const dayItems = calendarItems.filter((item) => includesDate(item, key));
              const shown = dayItems.slice(0, 3);
              return (
                <div
                  className={`calendar-date-cell ${date.getMonth() !== month.getMonth() ? "is-outside" : ""} ${selectedDate === key ? "is-selected" : ""}`}
                  key={key}
                >
                  <button
                    type="button"
                    className={`calendar-date-number ${key === today ? "is-today" : ""}`}
                    onClick={() => { setSelectedDate(key); setScope("date"); }}
                    aria-label={`${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 일정`}
                  >{date.getDate()}</button>
                  <div className="calendar-cell-items">
                    {shown.map((item) => (
                      <button
                        type="button"
                        className={`calendar-cell-item calendar-bar ${item.type} ${item.completed ? "is-completed" : ""}`}
                        key={item.id}
                        onClick={() => { const parent = sourceFor(item); if (parent) onSelect(parent); }}
                        title={item.title}
                      ><i aria-hidden="true" /><span>{item.title}</span></button>
                    ))}
                    {dayItems.length > shown.length && (
                      <button
                        type="button"
                        className="calendar-cell-more"
                        onClick={() => { setSelectedDate(key); setScope("date"); }}
                      >+{dayItems.length - shown.length} more</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="calendar-legend">
            <span><i className="todo-dot" /> To Do</span>
            <span><i className="task-dot" /> Task</span>
            <span>기간은 선으로 이어져요</span>
          </p>
        </section>

        <aside className="calendar-information-panel" aria-label="To Do, Task, Note 정보">
          <div className="calendar-information-heading">
            <div><span className="calendar-kicker">INFORMATION</span><h2>{scope === "date" ? selectedLabel : "All items"}</h2></div>
            <button className="calendar-scope-button" onClick={() => setScope((current) => current === "date" ? "all" : "date")}>
              {scope === "date" ? "전체 보기" : "선택일 보기"}
            </button>
          </div>
          <nav className="calendar-information-tabs" aria-label="정보 종류">
            {(["todo", "task", "note"] as const).map((kind) => (
              <button type="button" key={kind} className={filter === kind ? "is-active" : ""} onClick={() => setFilter(kind)}>
                {kind === "todo" ? "To Do" : kind === "task" ? "Task" : "Note"}
                <span>{kind === "todo" ? todos.filter((item) => !item.completed).length : kind === "task" ? tasks.length : notes.length}</span>
              </button>
            ))}
          </nav>
          <div className="calendar-information-list">
            {panelItems.length ? panelItems.map((item) => {
              const parent = sourceFor(item);
              const isCompleting = completing.includes(item.id);
              return (
                <article key={item.id} className={`calendar-information-card ${item.type} ${item.completed ? "is-completed" : ""} ${isCompleting ? "is-completing" : ""}`}>
                  {item.type !== "note" && (
                    <input type="checkbox" checked={item.completed} onChange={(event) => void toggleCompleted(item, event.target.checked)} aria-label={`${item.title} 완료`} />
                  )}
                  <button type="button" className="calendar-information-open" onClick={() => parent && onSelect(parent)}>
                    <strong style={{ fontSize: `${titleSize(item.title)}px` }}>{item.title}</strong>
                    <span>{item.content || "내용 없음"}</span>
                    <small>
                      {item.type === "todo" ? "To Do" : item.type === "task" ? "Task" : "Note"}
                      {item.startDate ? ` · ${item.startDate}` : ""}{item.dueDate ? ` → ${item.dueDate}` : ""}
                    </small>
                  </button>
                </article>
              );
            }) : (
              <div className="calendar-information-empty"><span>✦</span><p>{scope === "date" ? "선택한 날짜에 표시할 항목이 없어요." : "아직 등록된 항목이 없어요."}</p><small>달력에서 날짜를 선택하거나 전체 보기를 눌러보세요.</small></div>
            )}
          </div>
        </aside>
      </div>
    </motion.section>
  );
}
