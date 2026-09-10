import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { CaptureItem } from "../types";
import { deadlineColor, deadlineProgress } from "../lib/deadlineColor";
import { dayKey } from "../lib/dates";
export default function CalendarView({
  items,
  onClose,
  onSelect,
  origin,
  quiet,
}: {
  items: CaptureItem[];
  onClose: () => void;
  onSelect: (i: CaptureItem) => void;
  origin: string;
  quiet: boolean;
}) {
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => dayKey(new Date()));
  const [listFilter, setListFilter] = useState<"all" | "todo" | "task">("all");

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, n) => {
      const d = new Date(first);
      d.setDate(first.getDate() + n);
      return d;
    });
  }, [month]);
  const visible = items
    .filter((i) => i.type !== "note")
    .flatMap<
      CaptureItem & { sourceId?: string }
    >((i) => [i, ...(i.type === "todo" ? (i.subtasks || []).map((t) => ({ ...i, id: t.id, sourceId: i.id, type: "task" as const, title: t.title + " · " + i.title, content: t.content || "", startDate: t.startDate || i.startDate, dueDate: t.dueDate || null, completed: t.completed })) : [])]);
  const selectedItems = visible.filter((item) => {
    const end = item.dueDate || item.startDate;
    return (
      selectedDate >= item.startDate &&
      selectedDate <= end &&
      (listFilter === "all" || item.type === listFilter)
    );
  });
  return (
    <motion.section
      className="panel calendar-screen"
      initial={{ clipPath: `circle(20px at ${origin})`, opacity: 0.5 }}
      animate={{ clipPath: `circle(150% at ${origin})`, opacity: 1 }}
      exit={{ clipPath: `circle(20px at ${origin})`, opacity: 0 }}
      transition={{ duration: quiet ? 0.1 : 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <header className="panel-header">
        <button aria-label="캘린더 닫기" onClick={onClose}>
          ←
        </button>
        <h1>
          {month.toLocaleDateString("en", { month: "long", year: "numeric" })}
        </h1>
        <div className="month-actions">
          <button
            aria-label="이전 달"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
          >
            ‹
          </button>
          <button
            aria-label="다음 달"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
          >
            ›
          </button>
        </div>
      </header>
      <p className="muted">Todo와 Task를 한눈에</p>
      <div className="weekday-row">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="calendar-weeks">
        {Array.from({ length: 6 }, (_, w) => {
          const week = days.slice(w * 7, w * 7 + 7),
            keys = week.map(dayKey);
          const spanning = visible.filter(
            (i) =>
              i.startDate <= keys[6] && (i.dueDate || i.startDate) >= keys[0],
          );
          return (
            <div className="calendar-week" key={w}>
              <div className="week-dates">
                {week.map((d) => (
                  <div
                    key={dayKey(d)}
                    className={`calendar-day ${d.getMonth() !== month.getMonth() ? "muted" : ""}`}
                  >
                    <button
                      type="button"
                      className={`${dayKey(d) === dayKey() ? "today" : ""} ${selectedDate === dayKey(d) ? "selected" : ""}`}
                      onClick={() => setSelectedDate(dayKey(d))}
                      aria-label={`${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 일정`}
                    >
                      {d.getDate()}
                    </button>
                  </div>
                ))}
              </div>
              <div className="week-events">
                {spanning.map((i, lane) => {
                  const start = Math.max(
                    0,
                    keys.findIndex((k) => k >= i.startDate),
                  );
                  const end = keys.reduce(
                    (last, k, n) =>
                      k <= (i.dueDate || i.startDate) ? n : last,
                    0,
                  );
                  return (
                    <button
                      className="calendar-bar"
                      key={i.id}
                      onClick={() =>
                        onSelect(
                          i.sourceId
                            ? items.find((p) => p.id === i.sourceId)!
                            : i,
                        )
                      }
                      title={`${i.title}: ${i.startDate} → ${i.dueDate || i.startDate}`}
                      style={{
                        gridColumn: `${start + 1} / ${end + 2}`,
                        gridRow: lane + 1,
                        background:
                          i.type === "note"
                            ? "#e4d5c8"
                            : deadlineColor(
                                deadlineProgress(i.startDate, i.dueDate),
                              ),
                        opacity: i.completed ? 0.5 : 1,
                        borderRadius: `${i.startDate < keys[0] ? "0" : "8px"} ${(i.dueDate || i.startDate) > keys[6] ? "0" : "8px"} ${(i.dueDate || i.startDate) > keys[6] ? "0" : "8px"} ${i.startDate < keys[0] ? "0" : "8px"}`,
                      }}
                    >
                      {i.title}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <nav className="calendar-tabs" aria-label="선택한 날짜 목록 필터">
        {(["all", "todo", "task"] as const).map((filter) => (
          <button
            key={filter}
            className={listFilter === filter ? "active" : ""}
            onClick={() => setListFilter(filter)}
          >
            {filter === "all" ? "전체" : filter === "todo" ? "Todo" : "Task"}
          </button>
        ))}
      </nav>
      <section
        className="calendar-selected-list"
        aria-label={`${selectedDate} 일정 목록`}
      >
        <div className="calendar-selected-heading">
          <strong>{selectedDate.split("-").join(". ")}</strong>
          <span>{selectedItems.length}개</span>
        </div>
        {selectedItems.length ? (
          selectedItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`calendar-list-item ${item.type}`}
              onClick={() =>
                onSelect(
                  item.sourceId
                    ? items.find((p) => p.id === item.sourceId)!
                    : item,
                )
              }
            >
              <i aria-hidden="true" />
              <span>
                <b>{item.title}</b>
                <small>
                  {item.type === "todo" ? "Todo" : "Task"}
                  {item.dueDate
                    ? ` · ${item.startDate} → ${item.dueDate}`
                    : ` · ${item.startDate}`}
                </small>
              </span>
            </button>
          ))
        ) : (
          <p className="calendar-list-empty">
            선택한 날짜에 Todo와 Task가 없어요.
          </p>
        )}
      </section>
    </motion.section>
  );
}
