import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { CaptureItem, ItemType } from "../types";
import { deadlineColor, deadlineProgress } from "../lib/deadlineColor";

type Props = {
  items: CaptureItem[];
  onClose: () => void;
  onSelect: (item: CaptureItem) => void;
};

function monthLabel(date: Date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function firstGridDate(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const day = first.getDay();
  const mondayIndex = (day + 6) % 7;
  const grid = new Date(first);
  grid.setDate(first.getDate() - mondayIndex);
  return grid;
}

function formatDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function CalendarView({ items, onClose, onSelect }: Props) {
  const [month, setMonth] = useState(() => new Date());
  const [filter, setFilter] = useState<ItemType | "all">("all");

  const days = useMemo(() => {
    const start = firstGridDate(month);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [month]);

  const visibleItems = items.filter((item) => filter === "all" || item.type === filter);

  return (
    <motion.section
      className="calendar-screen"
      initial={{ clipPath: "circle(24px at 50% 92%)", opacity: 0.6 }}
      animate={{ clipPath: "circle(150% at 50% 50%)", opacity: 1 }}
      exit={{ clipPath: "circle(24px at 50% 92%)", opacity: 0 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
    >
      <header className="calendar-header">
        <button type="button" onClick={onClose}>←</button>
        <strong>{monthLabel(month)}</strong>
        <div className="month-actions">
          <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
          <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
        </div>
      </header>

      <div className="weekday-row">
        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => <span key={d}>{d}</span>)}
      </div>

      <div className="calendar-grid">
        {days.map((day) => {
          const key = formatDayKey(day);
          const sameMonth = day.getMonth() === month.getMonth();
          const dayItems = visibleItems.filter((item) => {
            const start = item.startDate;
            const due = item.dueDate ?? item.startDate;
            return key >= start && key <= due;
          });

          return (
            <div className={`calendar-day ${sameMonth ? "" : "calendar-day--muted"}`} key={key}>
              <span className="day-number">{day.getDate()}</span>
              <div className="day-bars">
                {dayItems.slice(0, 3).map((item) => {
                  const color = item.type === "note"
                    ? "#D8C9B8"
                    : deadlineColor(deadlineProgress(item.startDate, item.dueDate));

                  return (
                    <button
                      type="button"
                      className="calendar-bar"
                      key={item.id}
                      style={{ background: color }}
                      title={item.title || item.type}
                      onClick={() => onSelect(item)}
                    >
                      {item.title || item.type}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <nav className="calendar-tabs">
        {(["todo", "task", "note"] as ItemType[]).map((type) => (
          <button
            type="button"
            className={filter === type ? "active" : ""}
            key={type}
            onClick={() => setFilter(filter === type ? "all" : type)}
          >
            {type[0].toUpperCase() + type.slice(1)}
          </button>
        ))}
      </nav>
    </motion.section>
  );
}
