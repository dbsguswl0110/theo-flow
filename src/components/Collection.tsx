import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import type { CaptureItem, DraftItem, ItemType, Subtask } from "../types";
import { emptyDraft } from "../lib/dates";
import { deadlineColor, deadlineProgress } from "../lib/deadlineColor";
import { burst, celebrate, feedback } from "../lib/feedback";
import MemoFields from "./MemoFields";
import SwipeRow, { type SwipeAction } from "./SwipeRow";
import { CheckIcon, EmptyState, PlusIcon, ScreenHeader, TrashIcon, UndoIcon, type Tone } from "./ui";
import { isMacApp } from "../lib/platform";

type Entry = {
  key: string;
  item: CaptureItem;
  /** Set when the row is a child Task of a Todo shown inside the Task list. */
  sub?: Subtask;
  title: string;
  content: string;
  startDate: string;
  dueDate: string | null;
  completed: boolean;
};

// Kinds that have a "new" button on their list (the Mac app has no swipe pad, so Todo needs one too).
const CREATABLE = ["note", "task", "todo"];

const COPY: Record<string, { title: string; line: string; empty: string; hint: string }> = {
  note: {
    title: "Note",
    line: "TEO가 물어 온 생각 모음",
    empty: "아직 메모가 없어요",
    hint: "홈에서 메모지를 왼쪽으로 던지면 여기로 와요.",
  },
  task: {
    title: "Task",
    line: "하나씩 해치우면 TEO가 기뻐해요",
    empty: "할 일이 하나도 없어요",
    hint: "메모지를 오른쪽으로 던지면 Task가 생겨요.",
  },
  todo: {
    title: "Todo",
    line: "큰 일은 담아 두고 Task로 쪼개요",
    empty: "아직 Todo가 없어요",
    hint: "메모지를 위로 던지면 Todo가 생겨요.",
  },
  trash: {
    title: "Trash",
    line: "3일이 지나면 TEO가 깨끗이 치워요",
    empty: "휴지통이 깨끗해요",
    hint: "지운 항목은 3일 동안 여기 보관돼요.",
  },
};

const short = (date: string) => {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
};
// Notes have no deadline, so only Todo and Task cards say "마감 없음".
const range = (entry: Entry) =>
  entry.dueDate && entry.dueDate !== entry.startDate
    ? `${short(entry.startDate)} → ${short(entry.dueDate)}`
    : entry.dueDate || entry.item.type === "note"
      ? short(entry.startDate)
      : `${short(entry.startDate)} · 마감 없음`;
const preview = (content: string) => content.replace(/\s*\n+\s*(?:[-*•]\s*)?/g, " · ").trim();

const own = (item: CaptureItem): Entry => ({
  key: item.id,
  item,
  title: item.title,
  content: item.content,
  startDate: item.startDate,
  dueDate: item.dueDate,
  completed: item.completed,
});

export default function Collection({
  kind,
  items,
  onClose,
  onSelect,
  onSave,
  folders,
  onAddFolder,
  onCreate,
  onDeleteForever,
  onNotify,
  autoCompose = false,
  onAutoComposed,
}: {
  kind: string;
  items: CaptureItem[];
  onClose?: () => void;
  onSelect: (i: CaptureItem) => void;
  onSave: (i: CaptureItem) => Promise<boolean>;
  folders: string[];
  onAddFolder: (name: string) => Promise<boolean>;
  onCreate: (kind: ItemType, draft: DraftItem) => Promise<boolean>;
  onDeleteForever: (ids: string[]) => Promise<string[]>;
  onNotify: (message: string) => void;
  /** Unfold the composer on arrival (widget "＋" link). */
  autoCompose?: boolean;
  onAutoComposed?: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [folder, setFolder] = useState("*");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState<DraftItem>(emptyDraft);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!autoCompose || !CREATABLE.includes(kind)) return;
    setComposing(true);
    onAutoComposed?.();
  }, [autoCompose, kind, onAutoComposed]);
  // The composer animates open; put the cursor in its title once it exists.
  useEffect(() => {
    if (!composing) return;
    const focus = window.setTimeout(
      () => document.querySelector<HTMLInputElement>(".inline-composer .memo-title")?.focus(),
      220,
    );
    return () => window.clearTimeout(focus);
  }, [composing]);
  const copy = COPY[kind] || COPY.note;
  const trash = kind === "trash";
  const checkable = kind === "task" || kind === "todo";
  const showChecks = trash || selecting;

  const entries = useMemo<Entry[]>(() => {
    if (trash) return items.filter((i) => i.deletedAt).map(own);
    const live = items.filter((i) => !i.deletedAt);
    const mine = live
      .filter((i) => i.type === kind && (kind !== "note" || folder === "*" || (i.folder || "") === folder))
      .map(own);
    if (kind !== "task") return mine;
    const children = live
      .filter((i) => i.type === "todo")
      .flatMap((parent) =>
        (parent.subtasks || []).map<Entry>((sub) => ({
          key: sub.id,
          item: parent,
          sub,
          title: sub.title,
          content: sub.content || "",
          startDate: sub.startDate || parent.startDate,
          dueDate: sub.dueDate || null,
          completed: sub.completed,
        })),
      );
    return [...mine, ...children];
  }, [items, kind, folder, trash]);
  const open = entries.filter((e) => !e.completed);
  const done = entries.filter((e) => e.completed);
  const selectable = entries.filter((e) => !e.sub);

  async function save(item: CaptureItem) {
    setBusy(true);
    try {
      return await onSave(item);
    } finally {
      setBusy(false);
    }
  }
  async function toggleDone(entry: Entry, from: Element) {
    const next = !entry.completed;
    const updated: CaptureItem = entry.sub
      ? {
          ...entry.item,
          subtasks: (entry.item.subtasks || []).map((t) => (t.id === entry.sub!.id ? { ...t, completed: next } : t)),
        }
      : { ...entry.item, completed: next };
    if ((await save(updated)) && next) celebrate(from);
  }
  async function moveToTrash(item: CaptureItem, from?: Element) {
    if (!(await save({ ...item, deletedAt: new Date().toISOString() }))) return;
    if (from) {
      const box = from.getBoundingClientRect();
      burst("calendar", box.left + box.width / 2, box.top + box.height / 2);
    }
    feedback.land();
    onNotify(`"${item.title}"을(를) 휴지통으로 옮겼어요.`);
  }
  async function restore(item: CaptureItem) {
    if (await save({ ...item, deletedAt: null })) onNotify(`"${item.title}"이(가) 돌아왔어요.`);
  }
  async function moveSelectedToTrash() {
    if (!selected.length || busy) return;
    setBusy(true);
    try {
      for (const id of selected) {
        const item = items.find((i) => i.id === id);
        if (item) await onSave({ ...item, deletedAt: new Date().toISOString() });
      }
      onNotify(`${selected.length}개를 휴지통으로 옮겼어요.`);
      setSelected([]);
      setSelecting(false);
    } finally {
      setBusy(false);
    }
  }
  async function permanentlyDeleteSelected() {
    if (!selected.length || busy) return;
    setBusy(true);
    try {
      const removed = await onDeleteForever(selected);
      setSelected((prev) => prev.filter((id) => !removed.includes(id)));
    } finally {
      setBusy(false);
      setConfirmingDelete(false);
    }
  }
  async function createFromPanel(e: FormEvent) {
    e.preventDefault();
    if (!draft.title.trim() || !draft.startDate || busy) return;
    setBusy(true);
    setMessage("");
    try {
      if (await onCreate(kind as ItemType, draft)) {
        setDraft(emptyDraft());
        setComposing(false);
      } else setMessage("저장하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  const actionsFor = (entry: Entry): { right?: SwipeAction; left?: SwipeAction } => {
    if (trash)
      return { right: { label: "복원", icon: <UndoIcon />, color: "#8fbbe8", run: () => void restore(entry.item) } };
    return {
      right: checkable
        ? {
            label: entry.completed ? "다시 열기" : "완료",
            icon: <CheckIcon />,
            color: "#8cc48a",
            run: (row) => void toggleDone(entry, row),
          }
        : undefined,
      left: entry.sub
        ? undefined
        : { label: "휴지통", icon: <TrashIcon />, color: "#e69a8a", run: (row) => void moveToTrash(entry.item, row) },
    };
  };

  const renderEntry = (entry: Entry, index: number) => {
    const { item } = entry;
    const progress = entry.dueDate && !entry.completed ? deadlineProgress(entry.startDate, entry.dueDate) : 0;
    const subtotal = item.type === "todo" && !entry.sub ? item.subtasks?.length || 0 : 0;
    const subdone = item.type === "todo" && !entry.sub ? item.subtasks?.filter((t) => t.completed).length || 0 : 0;
    const actions = actionsFor(entry);
    return (
      <motion.div
        key={entry.key}
        layout="position"
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, x: -40, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 420, damping: 32, delay: Math.min(index, 8) * 0.035 }}
      >
        <SwipeRow right={actions.right} left={actions.left} disabled={showChecks}>
          <article className={`collection-card tc-card tone-${entry.sub ? "task" : item.type} ${entry.completed ? "is-done" : ""}`}>
            <div className="tc-lead">
              {showChecks && !entry.sub ? (
                <input
                  className="collection-check"
                  type="checkbox"
                  checked={selected.includes(item.id)}
                  aria-label={`${entry.title} 선택`}
                  onChange={(e) =>
                    setSelected((prev) => (e.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id)))
                  }
                />
              ) : (checkable || entry.sub) && !trash ? (
                <button
                  type="button"
                  className="tc-check"
                  aria-pressed={entry.completed}
                  aria-label={`${entry.title} 완료 표시`}
                  disabled={busy}
                  onClick={(e) => void toggleDone(entry, e.currentTarget)}
                >
                  <CheckIcon />
                </button>
              ) : (
                <span className="tc-dot" aria-hidden="true" />
              )}
            </div>
            <button type="button" className="collection-open" onClick={() => onSelect(item)}>
              <strong>{entry.title}</strong>
              {entry.content.trim() && <span className="tc-snippet">{preview(entry.content)}</span>}
              <span className="tc-chips">
                {entry.sub && <span className="tc-chip tc-chip-parent">Todo · {item.title}</span>}
                <span className="tc-chip">{range(entry)}</span>
                {subtotal > 0 && (
                  <span className="tc-chip tc-chip-progress">
                    <i aria-hidden="true">
                      <b style={{ width: `${(subdone / subtotal) * 100}%` }} />
                    </i>
                    {subdone}/{subtotal} Task
                  </span>
                )}
                {entry.completed && <span className="tc-chip tc-chip-done">완료</span>}
              </span>
            </button>
            {kind === "note" && (
              <label className="folder-select">
                <select
                  aria-label={entry.title + " 폴더"}
                  disabled={busy}
                  value={item.folder || ""}
                  onChange={(e) => void save({ ...item, folder: e.target.value || null })}
                >
                  <option value="">미분류</option>
                  {folders.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {trash && (
              <button type="button" disabled={busy} className="tc-soft-btn" onClick={() => void restore(item)}>
                복원
              </button>
            )}
            {progress > 0 && (
              <i
                className="tc-deadline"
                aria-hidden="true"
                style={{ width: `${Math.max(progress, 0.04) * 100}%`, background: deadlineColor(progress) }}
              />
            )}
          </article>
        </SwipeRow>
      </motion.div>
    );
  };

  const tone = (trash ? "trash" : kind) as Tone;
  return (
    <motion.section
      className={`panel tc-screen collection-panel tone-${tone}`}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24, pointerEvents: "none" as const, transition: { duration: 0.18, ease: "easeIn" } }}
      transition={{ type: "spring", stiffness: 360, damping: 32 }}
    >
      <ScreenHeader
        title={copy.title}
        subtitle={copy.line}
        tone={tone}
        backLabel="목록 닫기"
        onBack={onClose}
        count={entries.length}
        actions={
          !trash && selectable.length > 0 ? (
            <button
              type="button"
              className={`tc-soft-btn ${selecting ? "is-on" : ""}`}
              onClick={() => {
                setSelecting(!selecting);
                setSelected([]);
              }}
            >
              {selecting ? "선택 끝" : "선택"}
            </button>
          ) : undefined
        }
      />

      {CREATABLE.includes(kind) && (
        <div className="tc-create">
          <button type="button" className="primary-btn collection-create" onClick={() => setComposing(!composing)}>
            <span aria-hidden="true">{composing ? "×" : <PlusIcon />}</span>
            {composing ? "작성 닫기" : `새 ${copy.title}`}
          </button>
        </div>
      )}
      <AnimatePresence initial={false}>
        {composing && (
          <motion.form
            key="composer"
            className="inline-composer tc-card"
            onSubmit={createFromPanel}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
          >
            <MemoFields draft={draft} onChange={setDraft} disabled={busy} />
            {kind === "note" && <p className="muted">사진은 저장 후 상세 화면에서 첨부할 수 있어요.</p>}
            {message && <p className="form-error">{message}</p>}
            <button className="primary-btn" disabled={busy || !draft.title.trim()}>
              저장
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {(selecting || trash) && selectable.length > 0 && (
        <div className="selection-toolbar tc-card">
          <label>
            <input
              type="checkbox"
              checked={selected.length === selectable.length && selectable.length > 0}
              onChange={(e) => setSelected(e.target.checked ? selectable.map((i) => i.item.id) : [])}
            />{" "}
            전체선택
          </label>
          <span>{selected.length}개 선택</span>
          {trash ? (
            <button className="danger-btn" disabled={!selected.length || busy} onClick={() => setConfirmingDelete(true)}>
              영구삭제
            </button>
          ) : (
            <button className="secondary-btn" disabled={!selected.length || busy} onClick={() => void moveSelectedToTrash()}>
              휴지통으로
            </button>
          )}
        </div>
      )}

      {kind === "note" && (
        <section className="folder-panel tc-folders" aria-label="Folder">
          <div className="folder-tabs">
            <button className={folder === "*" ? "active" : ""} onClick={() => setFolder("*")}>
              전체
            </button>
            <button className={folder === "" ? "active" : ""} onClick={() => setFolder("")}>
              미분류
            </button>
            {folders.map((f) => (
              <button key={f} className={folder === f ? "active" : ""} onClick={() => setFolder(f)}>
                ▱ {f}
              </button>
            ))}
            <button className="tc-add-folder" onClick={() => setAdding(!adding)}>
              + 폴더
            </button>
          </div>
          {adding && (
            <form
              className="folder-create"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!name.trim() || busy) return;
                setBusy(true);
                try {
                  if (await onAddFolder(name.trim())) {
                    setName("");
                    setAdding(false);
                  }
                } finally {
                  setBusy(false);
                }
              }}
            >
              <input
                aria-label="폴더 이름"
                maxLength={60}
                placeholder="폴더 이름"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button disabled={busy || !name.trim()} className="primary-btn">
                만들기
              </button>
            </form>
          )}
        </section>
      )}

      {!entries.length && (
        <EmptyState title={kind === "note" && folder !== "*" ? "이 폴더는 비어 있어요" : copy.empty} hint={isMacApp && !trash ? `위의 '새 ${copy.title}' 버튼으로 만들어 보세요.` : copy.hint} />
      )}
      <div className="collection-list tc-list">
        <AnimatePresence initial>{open.map(renderEntry)}</AnimatePresence>
        {done.length > 0 && (
          <>
            <h2 className="tc-section">완료 {done.length}</h2>
            <AnimatePresence initial>{done.map(renderEntry)}</AnimatePresence>
          </>
        )}
      </div>
      {confirmingDelete &&
        createPortal(
          <div className="confirm-backdrop">
            <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-delete-title">
              <strong id="confirm-delete-title">{selected.length}개를 영구 삭제할까요?</strong>
              <p>되돌릴 수 없어요.</p>
              <div className="confirm-actions">
                <button className="secondary-btn" disabled={busy} onClick={() => setConfirmingDelete(false)}>
                  취소
                </button>
                <button className="danger-solid-btn" disabled={busy} onClick={() => void permanentlyDeleteSelected()}>
                  {busy ? "삭제 중…" : "영구 삭제"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </motion.section>
  );
}
