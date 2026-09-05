import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import FloatingTheo from "./components/FloatingTheo";
import MemoPad from "./components/MemoPad";
import CalendarView from "./components/CalendarView";
import ItemDetail from "./components/ItemDetail";
import { createItemRemote, loadItems, loadItemsRemote, saveItems, updateItemRemote } from "./lib/storage";
import type { CaptureItem, DraftItem, ItemType } from "./types";

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

const emptyDraft = (): DraftItem => ({
  title: "",
  content: "",
  startDate: todayString(),
  dueDate: null
});

export default function App() {
  const [items, setItems] = useState<CaptureItem[]>(() => loadItems());
  const [remote, setRemote] = useState(false);
  const [draft] = useState<DraftItem>(() => emptyDraft());
  const [focused, setFocused] = useState(false);
  const [toast, setToast] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selected, setSelected] = useState<CaptureItem | null>(null);
  const [intro, setIntro] = useState(true);

  useEffect(() => {
    saveItems(items);
  }, [items]);

  useEffect(() => {
    let alive = true;
    loadItemsRemote().then((remoteItems) => {
      if (!alive || !remoteItems) return;
      setItems(remoteItems);
      setRemote(true);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setIntro(false), 2100);
    return () => window.clearTimeout(timer);
  }, []);

  function register(type: ItemType, memo: DraftItem) {
    const now = new Date().toISOString();
    const item: CaptureItem = {
      id: crypto.randomUUID(),
      type,
      title: memo.title.trim(),
      content: memo.content.trim(),
      startDate: memo.startDate || todayString(),
      dueDate: memo.dueDate,
      completed: false,
      createdAt: now,
      updatedAt: now,
      photos: type === "note" ? [] : undefined,
      subtasks: type === "todo" ? memo.content.split(/\n/).map((line, index) => ({ id: `${crypto.randomUUID()}-${index}`, title: line.replace(/^\s*(?:□|-|•)\s*/, "").trim() }).title).filter(Boolean).map((title) => ({ id: crypto.randomUUID(), title, completed: false })) : undefined
    };

    setItems((prev) => [item, ...prev]);
    if (remote) void createItemRemote(item);
    setFocused(false);

    const text = type === "note" ? "Note registered" : type === "task" ? "Task registered" : "Todo registered";
    setToast(text);
    window.setTimeout(() => setToast(""), 900);
  }

  function saveItem(updated: CaptureItem) {
    setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    if (remote) void updateItemRemote(updated);
    setSelected(updated);
  }

  const counts = useMemo(() => ({
    note: items.filter((i) => i.type === "note").length,
    task: items.filter((i) => i.type === "task").length,
    todo: items.filter((i) => i.type === "todo").length
  }), [items]);

  return (
    <main className="app-shell">
      <div className="home-stage">
        <div className="wallpaper" />

        <FloatingTheo label="TODO" className="todo-position" />
        <FloatingTheo label="NOTE" className="note-position" />
        <FloatingTheo label="TASK" className="task-position" />
        <FloatingTheo
          label="CALENDAR"
          className="calendar-position"
          onClick={() => setCalendarOpen(true)}
        />

        {focused && <button className="focus-overlay" aria-label="Close focus" onClick={() => setFocused(false)} />}

        <MemoPad
          initialValue={draft}
          focused={focused}
          onFocus={() => setFocused(true)}
          onBlurFocus={() => setFocused(false)}
          onRegister={register}
        />

        <div className="mini-counter" aria-hidden="true">
          <span>N {counts.note}</span>
          <span>T {counts.task}</span>
          <span>P {counts.todo}</span>
        </div>

        <AnimatePresence>
          {toast && <div className="toast">{toast}</div>}
        </AnimatePresence>

        <AnimatePresence>
          {calendarOpen && (
            <CalendarView
              items={items}
              onClose={() => setCalendarOpen(false)}
              onSelect={(item) => setSelected(item)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selected && (
            <ItemDetail
              item={selected}
              onClose={() => setSelected(null)}
              onSave={saveItem}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {intro && <motion.div className="intro-screen" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .45 }} aria-hidden="true">
            <motion.div className="intro-jelly" initial={{ y: 130, scale: .35 }} animate={{ y: -40, scale: [ .35, .62, 1, .78, 1 ] }} transition={{ duration: 1.3, ease: [ .22, 1, .36, 1 ] }} />
            <motion.div className="intro-rays" initial={{ opacity: 0, scale: .35 }} animate={{ opacity: [0, 1, 0], scale: [ .35, 1, 1.8 ] }} transition={{ delay: 1.15, duration: .85 }} />
            <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }} >Write · Swipe · Organise</motion.span>
          </motion.div>}
        </AnimatePresence>
      </div>
    </main>
  );
}
