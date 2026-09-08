import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import FloatingTheo from "./components/FloatingTheo";
import MemoPad from "./components/MemoPad";
import Startup from "./components/Startup";
import CalendarView from "./components/CalendarView";
import ItemDetail from "./components/ItemDetail";
import Collection from "./components/Collection";
import {
  createItemRemote,
  loadItems,
  loadItemsRemote,
  saveItems,
  updateItemRemote,
} from "./lib/storage";
import type { CaptureItem, DraftItem, ItemType } from "./types";

export default function App() {
  const [items, setItems] = useState<CaptureItem[]>(loadItems);
  const [focused, setFocused] = useState(false);
  const [toast, setToast] = useState("");
  const [accepted, setAccepted] = useState("");
  const [screen, setScreen] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [intro, setIntro] = useState(true);
  const [layout, setLayout] = useState(
    () => localStorage.getItem("theo-layout") || "auto",
  );
  const [quiet, setQuiet] = useState(
    () => localStorage.getItem("theo-quiet") === "true",
  );
  const reduce = useReducedMotion();
  const [size, setSize] = useState({ w: innerWidth, h: innerHeight });
  const stage = useRef<HTMLDivElement>(null);
  const pending = useRef(0),
    revision = useRef(0);
  const [sync, setSync] = useState("연결 중");
  const [origin, setOrigin] = useState("50% 87%");
  const toastTimer = useRef<number>();
  const noMotion = quiet || Boolean(reduce);
  const expanded =
    layout === "expanded" ||
    (layout === "auto" && size.w >= 680 && size.w / size.h > 0.78);
  const finishIntro = useCallback(() => setIntro(false), []);
  const notify = (message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      setToast("");
      setAccepted("");
    }, 2300);
  };
  useEffect(() => {
    if (reduce) setIntro(false);
  }, [reduce]);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height }),
    );
    if (stage.current) observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    saveItems(items);
  }, [items]);
  useEffect(() => {
    localStorage.setItem("theo-layout", layout);
    localStorage.setItem("theo-quiet", String(quiet));
  }, [layout, quiet]);
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      if (pending.current || document.hidden) return;
      const before = revision.current,
        data = await loadItemsRemote();
      if (!alive || pending.current || before !== revision.current) return;
      if (data) {
        setItems(data);
        setSync("동기화됨");
      } else setSync("연결 확인 필요");
    };
    void refresh();
    const interval = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => {
      alive = false;
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
      clearTimeout(toastTimer.current);
    };
  }, []);
  async function register(type: ItemType, draft: DraftItem) {
    const now = new Date().toISOString();
    const item: CaptureItem = {
      ...draft,
      id: crypto.randomUUID(),
      type,
      title: draft.title.trim(),
      content: draft.content.trim(),
      completed: false,
      createdAt: now,
      updatedAt: now,
      photos: [],
      subtasks: [],
    };
    pending.current++;
    revision.current++;
    try {
      const ok = await createItemRemote(item);
      if (!ok) {
        setSync("연결 확인 필요");
        return false;
      }
      setItems((prev) => [item, ...prev]);
      setSync("동기화됨");
      setAccepted(type === "todo" && expanded ? "project" : type);
      notify(
        type === "note"
          ? "노트에 메모가 등록되었습니다."
          : type === "task"
            ? "태스크가 등록되었습니다."
            : "프로젝트 Todo가 등록되었습니다.",
      );
      return true;
    } finally {
      pending.current--;
    }
  }
  async function saveItem(item: CaptureItem): Promise<boolean> {
    pending.current++;
    revision.current++;
    try {
      const updated = { ...item, updatedAt: new Date().toISOString() };
      if (!(await updateItemRemote(updated))) {
        notify("저장하지 못했어요. 연결을 확인해주세요.");
        return false;
      }
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
      return true;
    } finally {
      pending.current--;
    }
  }
  function openCalendar() {
    const a = stage.current?.getBoundingClientRect(),
      b = stage.current
        ?.querySelector('[data-target="calendar"]')
        ?.getBoundingClientRect();
    if (a && b)
      setOrigin(`${b.x + b.width / 2 - a.x}px ${b.y + b.height / 2 - a.y}px`);
    setScreen("calendar");
  }
  const selected = items.find((i) => i.id === selectedId);
  const visible = items.filter((i) => !i.deletedAt);
  return (
    <main className="app-shell">
      <div
        ref={stage}
        className={`home-stage ${expanded ? "expanded" : "folded"} ${noMotion ? "quiet" : ""}`}
      >
        <div className="wallpaper" />
        <header className="utility-bar">
          <span className="wordmark">
            theo flow <small>생각을 담는 작은 공간</small>
          </span>
          <nav aria-label="메뉴">
            <button onClick={() => setScreen("trash")}>Trash</button>
            <button onClick={() => setScreen("settings")}>Setting</button>
          </nav>
        </header>
        <div className="spatial-home">
          <FloatingTheo
            kind="note"
            label="Note"
            className="note-position"
            quiet={noMotion}
            accepted={accepted === "note"}
            onClick={() => setScreen("note")}
          />
          <FloatingTheo
            kind="task"
            label="Task"
            className="task-position"
            quiet={noMotion}
            accepted={accepted === "task"}
            onClick={() => setScreen("task")}
          />
          <FloatingTheo
            kind="todo"
            label="Todo"
            className="todo-position"
            quiet={noMotion}
            accepted={accepted === "todo"}
            onClick={() => setScreen(expanded ? "todos" : "project")}
          />
          {expanded && (
            <FloatingTheo
              kind="project"
              label="Project"
              className="project-position"
              quiet={noMotion}
              accepted={accepted === "project"}
              onClick={() => setScreen("project")}
            />
          )}
          <FloatingTheo
            kind="calendar"
            label="Calendar"
            className="calendar-position"
            quiet={noMotion}
            accepted={false}
            onClick={openCalendar}
          />
          {focused && (
            <button
              className="focus-overlay"
              aria-label="작성 모드 닫기"
              onClick={() => {
                if (document.activeElement instanceof HTMLElement)
                  document.activeElement.blur();
                setFocused(false);
              }}
            />
          )}
          <MemoPad
            active={!intro}
            focused={focused}
            onFocus={() => setFocused(true)}
            onBlurFocus={() => setFocused(false)}
            onRegister={register}
            quiet={noMotion}
          />
        </div>
        <footer className="home-caption">
          적고, 가볍게 보내세요.<span>← Note · ↑ Project Todo · Task →</span>
        </footer>
        <AnimatePresence>
          {toast && (
            <motion.div
              role="status"
              className="toast"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {screen === "calendar" && (
            <CalendarView
              items={visible}
              onClose={() => setScreen("")}
              onSelect={(i) => setSelectedId(i.id)}
              origin={origin}
              quiet={noMotion}
            />
          )}
          {["note", "task", "project", "todos", "trash"].includes(screen) && (
            <Collection
              kind={screen}
              items={items}
              onClose={() => setScreen("")}
              onSelect={(i) => setSelectedId(i.id)}
              onSave={saveItem}
            />
          )}
          {screen === "settings" && (
            <motion.section
              className="panel settings-panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <header className="panel-header">
                <button aria-label="설정 닫기" onClick={() => setScreen("")}>
                  ←
                </button>
                <h1>Setting</h1>
              </header>
              <label className="setting-row">
                화면 배치
                <select
                  value={layout}
                  onChange={(e) => setLayout(e.target.value)}
                >
                  <option value="auto">화면에 맞게 자동</option>
                  <option value="folded">접힌 화면 · 십자형</option>
                  <option value="expanded">펼친 화면 · 양쪽 독</option>
                </select>
              </label>
              <label className="setting-row">
                움직임 줄이기
                <input
                  type="checkbox"
                  checked={quiet}
                  onChange={(e) => setQuiet(e.target.checked)}
                />
              </label>
              <p>데이터 상태: {sync}</p>
              <p className="muted">
                Note · Task · Project Todo는 같은 캘린더에 모입니다. Todo
                독에서는 프로젝트의 하위 할 일을 확인할 수 있어요.
              </p>
              <button
                className="secondary-btn"
                onClick={() => {
                  setScreen("");
                  setIntro(true);
                }}
              >
                시작 애니메이션 다시 보기
              </button>
            </motion.section>
          )}
          {selected && (
            <ItemDetail
              key={selected.id}
              item={selected}
              onClose={() => setSelectedId(null)}
              onSave={saveItem}
            />
          )}
          {intro && <Startup onDone={finishIntro} />}
        </AnimatePresence>
      </div>
    </main>
  );
}
