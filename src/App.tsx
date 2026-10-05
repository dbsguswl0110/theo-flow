import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FloatingTheo from "./components/FloatingTheo";
import MemoPad from "./components/MemoPad";
import Startup from "./components/Startup";
import CalendarView from "./components/CalendarView";
import ItemDetail from "./components/ItemDetail";
import Collection from "./components/Collection";
import BurstLayer from "./components/BurstLayer";
import TeoCompanion from "./components/TeoCompanion";
import TeoSprite from "./components/TeoSprite";
import { dayKey } from "./lib/dates";
import { FACE } from "./lib/teoSprites";
import {
  burst,
  feedback,
  getFeedbackPrefs,
  setFeedbackPrefs,
  setFeedbackQuiet,
} from "./lib/feedback";
import {
  createItemRemote,
  deleteItemRemote,
  loadItems,
  loadItemsRemote,
  saveItems,
  updateItemRemote,
  loadFoldersRemote,
  createFolderRemote,
  uploadPhotoRemote,
} from "./lib/storage";
import type { CaptureItem, DraftItem, ItemType } from "./types";

export default function App() {
  const [folders, setFolders] = useState<string[]>([]);
  const [viewportHeight, setViewportHeight] = useState(
    window.visualViewport?.height || innerHeight,
  );
  const [items, setItems] = useState<CaptureItem[]>(loadItems);
  const [focused, setFocused] = useState(false);
  const [toast, setToast] = useState("");
  const [accepted, setAccepted] = useState("");
  const [swipePreview, setSwipePreview] = useState<ItemType | null>(null);
  const [swipeReady, setSwipeReady] = useState(false);
  const swipeReadyRef = useRef(false);
  const [cheerKey, setCheerKey] = useState(0);
  const [landed, setLanded] = useState<Record<string, number>>({});
  const [prefs, setPrefs] = useState(getFeedbackPrefs);
  const [screen, setScreen] = useState("");
  const routeStack = useRef<Array<{ screen: string; selectedId: string | null }>>([
    { screen: "", selectedId: null },
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Mirrors the committed route so repeated widget deep links do not stack duplicate history entries.
  const screenRef = useRef(screen);
  const selectedRef = useRef<string | null>(selectedId);
  screenRef.current = screen;
  selectedRef.current = selectedId;
  function navigate(nextScreen: string) {
    screenRef.current = nextScreen;
    selectedRef.current = null;
    routeStack.current.push({ screen: nextScreen, selectedId: null });
    window.history.pushState({ theoRoute: nextScreen, selectedId: null }, "", window.location.href);
    setSelectedId(null);
    setScreen(nextScreen);
  }
  function navigateBack() {
    if (routeStack.current.length > 1) window.history.back();
    else {
      setScreen("");
      setSelectedId(null);
    }
  }
  function selectItem(item: CaptureItem) {
    routeStack.current.push({ screen, selectedId: item.id });
    window.history.pushState({ theoRoute: screen, selectedId: item.id }, "", window.location.href);
    setSelectedId(item.id);
  }
  function openCollection(kind: string, back = "") {
    void back;
    navigate(kind);
  }
  const [intro, setIntro] = useState(true);
  const [introRevealed, setIntroRevealed] = useState(false);
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
  useEffect(() => setFeedbackQuiet(noMotion), [noMotion]);
  const handleSwipe = useCallback((type: ItemType | null, progress: number) => {
    stage.current?.style.setProperty("--swipe", progress.toFixed(3));
    setSwipePreview(type);
    const ready = type !== null && progress >= 1;
    if (ready !== swipeReadyRef.current) {
      swipeReadyRef.current = ready;
      setSwipeReady(ready);
      if (ready) feedback.ready();
    }
  }, []);
  useEffect(() => {
    const onCheer = () => setCheerKey((key) => key + 1);
    window.addEventListener("teo-cheer", onCheer);
    return () => window.removeEventListener("teo-cheer", onCheer);
  }, []);
  const expanded =
    layout === "expanded" ||
    (layout === "auto" && size.w >= 680 && size.w / size.h > 0.78);
  useEffect(() => {
    const current = window.history.state || {};
    window.history.replaceState(
      { ...current, theoRoute: "", selectedId: null },
      "",
      window.location.href,
    );
    const handlePopState = (event: PopStateEvent) => {
      if (routeStack.current.length > 1) routeStack.current.pop();
      const fallback = routeStack.current[routeStack.current.length - 1];
      const state = event.state as
        | { theoRoute?: string; selectedId?: string | null }
        | null;
      setScreen(state?.theoRoute ?? fallback?.screen ?? "");
      setSelectedId(state?.selectedId ?? fallback?.selectedId ?? null);
      setFocused(false);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  useEffect(() => {
    const resize = () =>
      setViewportHeight(window.visualViewport?.height || innerHeight);
    window.visualViewport?.addEventListener("resize", resize);
    window.addEventListener("resize", resize);
    return () => {
      window.visualViewport?.removeEventListener("resize", resize);
      window.removeEventListener("resize", resize);
    };
  }, []);
  async function addFolder(name: string) {
    pending.current++;
    revision.current++;
    try {
      if (!(await createFolderRemote(name))) {
        notify("폴더를 만들지 못했어요.");
        return false;
      }
      setFolders((prev) => Array.from(new Set([...prev, name])).sort());
      return true;
    } finally {
      pending.current--;
    }
  }
  const finishIntro = useCallback(() => setIntro(false), []);
  const revealIntro = useCallback(() => setIntroRevealed(true), []);
  useEffect(() => {
    stage.current
      ?.querySelectorAll(".utility-bar,.spatial-home,.home-caption")
      .forEach((el) => el.toggleAttribute("inert", intro));
  }, [intro]);
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
      const remoteFolders = await loadFoldersRemote();
      if (!alive || pending.current || before !== revision.current) return;
      if (data) {
        setItems(data);
        if (remoteFolders) setFolders(remoteFolders);
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
    const { photo: attachedPhoto, ...fields } = draft;
    const item: CaptureItem = {
      ...fields,
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
      if (type === "note" && attachedPhoto) {
        try {
          const uploaded = await uploadPhotoRemote(item.id, attachedPhoto);
          item.photos = [uploaded];
        } catch {
          notify("메모는 저장했지만 사진을 첨부하지 못했어요.");
        }
      }
      setItems((prev) => [item, ...prev]);
      setSync("동기화됨");
      setAccepted(type);
      setLanded((prev) => ({ ...prev, [type]: (prev[type] || 0) + 1 }));
      const icon = stage.current
        ?.querySelector(`[data-target="${type}"]`)
        ?.getBoundingClientRect();
      if (icon) burst(type, icon.left + icon.width / 2, icon.top + icon.height * 0.42);
      feedback.land();
      setCheerKey((key) => key + 1);
      notify(
        type === "note"
          ? "노트에 메모가 등록되었습니다."
          : type === "task"
            ? "태스크가 등록되었습니다."
            : "Todo가 등록되었습니다.",
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
  async function deleteForever(ids: string[]): Promise<string[]> {
    pending.current++;
    revision.current++;
    try {
      const outcomes = await Promise.all(
        ids.map(async (id) => ({ id, ok: await deleteItemRemote(id) })),
      );
      const removed = outcomes.filter((o) => o.ok).map((o) => o.id);
      if (removed.length)
        setItems((prev) => prev.filter((i) => !removed.includes(i.id)));
      notify(
        removed.length === ids.length
          ? `${removed.length}개를 영구 삭제했어요.`
          : "일부 항목을 삭제하지 못했어요. 연결을 확인해주세요.",
      );
      return removed;
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
    navigate("calendar");
  }
  useEffect(() => {
    const openFromWidget = (event: Event) => {
      const mode = (event as CustomEvent<string>).detail;
      if (!["calendar", "note", "task", "todo"].includes(mode)) return;
      // The Android shell re-sends the link a few times while the page loads; one visit is enough.
      if (screenRef.current === mode) {
        if (selectedRef.current) window.history.back();
        return;
      }
      if (mode === "calendar") openCalendar();
      else openCollection(mode);
    };
    window.addEventListener("theo-widget-open", openFromWidget);
    return () => window.removeEventListener("theo-widget-open", openFromWidget);
  }, []);
  const selected = items.find((i) => i.id === selectedId);
  const visible = items.filter((i) => !i.deletedAt);
  const stats = useMemo(() => {
    const today = dayKey();
    const live = items.filter((i) => !i.deletedAt);
    const entries = live.flatMap((item) =>
      item.type === "note"
        ? []
        : [
            { start: item.startDate, end: item.dueDate || item.startDate, done: item.completed },
            ...(item.type === "todo" ? item.subtasks || [] : []).map((sub) => ({
              start: sub.startDate || item.startDate,
              end: sub.dueDate || sub.startDate || item.startDate,
              done: sub.completed,
            })),
          ],
    );
    const onToday = entries.filter((e) => e.start && e.start <= today && today <= e.end);
    return {
      note: live.filter((i) => i.type === "note").length,
      todo: live.filter((i) => i.type === "todo" && !i.completed).length,
      task:
        live.filter((i) => i.type === "task" && !i.completed).length +
        live.reduce(
          (n, i) => n + (i.type === "todo" ? (i.subtasks || []).filter((t) => !t.completed).length : 0),
          0,
        ),
      today: onToday.filter((e) => !e.done).length,
      todayDone: onToday.filter((e) => e.done).length,
      todayTotal: onToday.length,
    };
  }, [items]);
  const meter = useRef<{ done: number; total: number } | null>(null);
  useEffect(() => {
    const previous = meter.current;
    meter.current = { done: stats.todayDone, total: stats.todayTotal };
    if (!previous || previous.total === 0 || stats.todayTotal === 0) return;
    const finished = stats.todayDone === stats.todayTotal && previous.done < previous.total;
    const key = `teo-all-done-${dayKey()}`;
    let seen = false;
    try {
      seen = localStorage.getItem(key) === "1";
    } catch {
      /* storage unavailable */
    }
    if (!finished || seen) return;
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* storage unavailable */
    }
    const box = stage.current?.querySelector(".today-meter")?.getBoundingClientRect();
    if (box) burst("done", box.left + box.width / 2, box.top);
    feedback.done();
    setCheerKey((k) => k + 1);
    notify("오늘 할 일을 모두 끝냈어요! TEO가 신나요.");
  }, [stats.todayDone, stats.todayTotal]);
  return (
    <main className="app-shell">
      <div
        ref={stage}
        style={{ height: viewportHeight }}
        data-swipe={swipePreview || undefined}
        data-ready={swipeReady || undefined}
        className={`home-stage ${expanded ? "expanded" : "folded"} ${noMotion ? "quiet" : ""} ${focused ? "is-writing" : ""} ${intro && !introRevealed ? "intro-waiting" : ""}`}
      >
        <header className="utility-bar">
          <span className="wordmark" aria-hidden="true" />
          <nav aria-label="메뉴">
            <button onClick={() => navigate("trash")}>Trash</button>
            <button onClick={() => navigate("settings")}>Setting</button>
          </nav>
        </header>
        <div className="spatial-home">
          <FloatingTheo
            kind="note"
            label="Note"
            className="note-position"
            quiet={noMotion || intro}
            accepted={accepted === "note"}
            pulse={landed.note || 0}
            count={stats.note}
            onClick={() => openCollection("note")}
          />
          <FloatingTheo
            kind="task"
            label="Task"
            className="task-position"
            quiet={noMotion || intro}
            accepted={accepted === "task"}
            pulse={landed.task || 0}
            count={stats.task}
            onClick={() => openCollection("task")}
          />
          <FloatingTheo
            kind="todo"
            label="Todo"
            className="todo-position"
            quiet={noMotion || intro}
            accepted={accepted === "todo"}
            pulse={landed.todo || 0}
            count={stats.todo}
            onClick={() => openCollection("todo")}
          />
          <FloatingTheo
            kind="calendar"
            label="Calendar"
            className="calendar-position"
            quiet={noMotion || intro}
            accepted={false}
            count={stats.today}
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
            active={!intro || introRevealed}
            focused={focused}
            onFocus={() => setFocused(true)}
            onBlurFocus={() => setFocused(false)}
            onRegister={register}
            onSwipePreview={handleSwipe}
            quiet={noMotion}
            companion={
              <TeoCompanion
                active={!intro || introRevealed}
                quiet={noMotion}
                look={swipePreview}
                ready={swipeReady}
                cheerKey={cheerKey}
              />
            }
          />
        </div>
        <footer className="home-caption">
          {stats.todayTotal > 0 ? (
            <span
              className={`today-meter ${stats.todayDone === stats.todayTotal ? "is-complete" : ""}`}
              role="progressbar"
              aria-label="오늘 할 일"
              aria-valuemin={0}
              aria-valuemax={stats.todayTotal}
              aria-valuenow={stats.todayDone}
              aria-valuetext={`오늘 ${stats.todayTotal}개 중 ${stats.todayDone}개 완료`}
            >
              <span className="today-meter-track" aria-hidden="true">
                <i style={{ width: `${(stats.todayDone / stats.todayTotal) * 100}%` }} />
              </span>
              <b>
                오늘 {stats.todayDone}/{stats.todayTotal}
              </b>
            </span>
          ) : (
            "적고, 가볍게 보내세요."
          )}
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
              <span className="toast-teo" aria-hidden="true">
                <TeoSprite
                  cell={toast.includes("못했") ? FACE.surprised : accepted ? FACE.tongue : FACE.smile}
                  size={52}
                />
              </span>
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {screen === "calendar" && (
            <CalendarView
              items={visible}
              onClose={navigateBack}
              onSelect={selectItem}
              onSave={saveItem}
              onOpenNotes={() => openCollection("note", "calendar")}
              origin={origin}
              quiet={noMotion}
            />
          )}
          {["note", "task", "todo", "trash"].includes(screen) && (
            <Collection
              key={screen}
              kind={screen}
              folders={folders}
              onAddFolder={addFolder}
              items={items}
              onClose={navigateBack}
              onSelect={selectItem}
              onSave={saveItem}
              onDeleteForever={deleteForever}
              onCreate={(kind, draft) => register(kind as ItemType, draft)}
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
                <button aria-label="설정 닫기" onClick={navigateBack}>
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
                  <option value="expanded">펼친 화면 · 넓은 십자형</option>
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
              <label className="setting-row">
                진동 피드백
                <input
                  type="checkbox"
                  checked={prefs.haptics}
                  onChange={(e) => {
                    const next = { ...prefs, haptics: e.target.checked };
                    setPrefs(next);
                    setFeedbackPrefs(next);
                    if (next.haptics) feedback.pet();
                  }}
                />
              </label>
              <label className="setting-row">
                효과음
                <input
                  type="checkbox"
                  checked={prefs.sound}
                  onChange={(e) => {
                    const next = { ...prefs, sound: e.target.checked };
                    setPrefs(next);
                    setFeedbackPrefs(next);
                    if (next.sound) feedback.pet();
                  }}
                />
              </label>
              <p>데이터 상태: {sync}</p>
              <p className="muted">
                위 Todo는 프로젝트 역할을 하며 내부에 Task를 추가할 수 있어요.
                캘린더 달력에는 Todo와 Task만 그려지고, Note는 옆 정보 열에서
                볼 수 있어요. Note는 폴더로 분류할 수 있어요.
              </p>
              <button
                className="secondary-btn"
                onClick={() => {
                  navigateBack();
                  setFocused(false);
                  setIntroRevealed(false);
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
              folders={folders}
              onClose={navigateBack}
              onSave={saveItem}
            />
          )}
          {intro && (
            <Startup
              stage={stage}
              onReveal={revealIntro}
              onDone={finishIntro}
              quiet={noMotion}
            />
          )}
        </AnimatePresence>
      </div>
      <BurstLayer quiet={noMotion} />
    </main>
  );
}
