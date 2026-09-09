import { motion } from "framer-motion";
import { useState, type FormEvent } from "react";
import type { CaptureItem, DraftItem, ItemType } from "../types";
import { deleteItemRemote } from "../lib/storage";
import { emptyDraft } from "../lib/dates";
import MemoFields from "./MemoFields";
export default function Collection({
  kind,
  items,
  onClose,
  onSelect,
  onSave,
  folders,
  onAddFolder,
  onCreate,
}: {
  kind: string;
  items: CaptureItem[];
  onClose: () => void;
  onSelect: (i: CaptureItem) => void;
  onSave: (i: CaptureItem) => Promise<boolean>;
  folders: string[];
  onAddFolder: (name: string) => Promise<boolean>;
  onCreate: (kind: ItemType, draft: DraftItem) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false),
    [folder, setFolder] = useState("*"),
    [adding, setAdding] = useState(false),
    [name, setName] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [composing, setComposing] = useState(false),
    [draft, setDraft] = useState<DraftItem>(emptyDraft),
    [message, setMessage] = useState("");
  async function save(item: CaptureItem) {
    setBusy(true);
    try {
      await onSave(item);
    } finally {
      setBusy(false);
    }
  }
  const visible = items.filter((i) =>
    kind === "trash"
      ? !!i.deletedAt
      : !i.deletedAt &&
        i.type === kind &&
        (kind !== "note" || folder === "*" || (i.folder || "") === folder),
  );
  const childTasks =
    kind === "task"
      ? items
          .filter((i) => i.type === "todo" && !i.deletedAt)
          .flatMap((parent) =>
            (parent.subtasks || []).map((task) => ({ parent, task })),
          )
      : [];
  const title =
    kind === "todo"
      ? "Todo"
      : kind === "task"
        ? "Task"
        : kind === "note"
          ? "Note"
        : "Trash";
  const selectable = visible;
  async function moveSelectedToTrash() {
    if (!selected.length || busy) return;
    setBusy(true);
    try {
      for (const id of selected) {
        const item = items.find((i) => i.id === id);
        if (item) await save({ ...item, deletedAt: new Date().toISOString() });
      }
      setSelected([]);
    } finally {
      setBusy(false);
    }
  }
  async function permanentlyDeleteSelected() {
    if (!selected.length || busy) return;
    setBusy(true);
    try {
      for (const id of selected) await deleteItemRemote(id);
      setSelected([]);
      window.location.reload();
    } finally {
      setBusy(false);
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
  return (
    <motion.section
      className="panel collection-panel"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
    >
      <header className="panel-header">
        <button aria-label="목록 닫기" onClick={onClose}>
          ←
        </button>
        <h1>{title}</h1>
        <span>{visible.length + childTasks.length}</span>
      </header>
      {kind !== "trash" && (kind === "note" || kind === "task") && (
        <button className="primary-btn collection-create" onClick={() => setComposing(!composing)}>
          {composing ? "작성 닫기" : `+ 새 ${title}`}
        </button>
      )}
      {composing && (
        <form className="inline-composer" onSubmit={createFromPanel}>
          <MemoFields draft={draft} onChange={setDraft} disabled={busy} />
          {kind === "note" && <p className="muted">사진은 저장 후 상세 화면에서 첨부할 수 있어요.</p>}
          {message && <p className="form-error">{message}</p>}
          <button className="primary-btn" disabled={busy || !draft.title.trim()}>저장</button>
        </form>
      )}
      {selectable.length > 0 && (
        <div className="selection-toolbar">
          <label><input type="checkbox" checked={selected.length === selectable.length} onChange={(e) => setSelected(e.target.checked ? selectable.map(i => i.id) : [])} /> 전체선택</label>
          <span>{selected.length}개 선택</span>
          {kind === "trash" ? <button className="danger-btn" disabled={!selected.length || busy} onClick={() => void permanentlyDeleteSelected()}>영구삭제</button> : <button className="secondary-btn" disabled={!selected.length || busy} onClick={() => void moveSelectedToTrash()}>휴지통으로</button>}
        </div>
      )}
      <p className="muted">
        {kind === "todo"
          ? "Todo를 열어 안에 Task를 나눠 담으세요."
          : kind === "trash"
            ? "옮긴 항목을 복원할 수 있어요."
            : "한 장의 생각이 모이는 곳"}
      </p>
      {kind === "note" && (
        <section className="folder-panel" aria-label="Folder">
          <div className="folder-heading">
            <h2>Folder</h2>
            <button
              className="secondary-btn"
              onClick={() => setAdding(!adding)}
            >
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
          <div className="folder-tabs">
            <button
              className={folder === "*" ? "active" : ""}
              onClick={() => setFolder("*")}
            >
              전체
            </button>
            <button
              className={folder === "" ? "active" : ""}
              onClick={() => setFolder("")}
            >
              미분류
            </button>
            {folders.map((f) => (
              <button
                key={f}
                className={folder === f ? "active" : ""}
                onClick={() => setFolder(f)}
              >
                ▱ {f}
              </button>
            ))}
          </div>
        </section>
      )}
      {!visible.length && !childTasks.length && (
        <div className="empty-state">아직 비어 있어요.</div>
      )}
      {visible.map((i) => (
        <article className="collection-card" key={i.id}>
          <input className="collection-check" type="checkbox" checked={selected.includes(i.id)} aria-label={`${i.title} 선택`} onChange={(e) => setSelected(prev => e.target.checked ? [...prev, i.id] : prev.filter(id => id !== i.id))} />
          <button className="collection-open" onClick={() => onSelect(i)}>
            <strong>{i.title}</strong>
            <span>{i.content || "내용 없음"}</span>
            <small>
              {i.startDate}
              {i.dueDate ? " → " + i.dueDate : " · 마감 없음"}
              {i.type === "todo"
                ? " · " +
                  (i.subtasks?.filter((t) => t.completed).length || 0) +
                  "/" +
                  (i.subtasks?.length || 0) +
                  " Task"
                : ""}
            </small>
          </button>
          {kind === "note" && (
            <label className="folder-select">
              Folder
              <select
                aria-label={i.title + " 폴더"}
                disabled={busy}
                value={i.folder || ""}
                onChange={(e) =>
                  void save({ ...i, folder: e.target.value || null })
                }
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
          {kind === "trash" && (
            <button
              disabled={busy}
              className="secondary-btn"
              onClick={() => void save({ ...i, deletedAt: null })}
            >
              복원
            </button>
          )}
        </article>
      ))}
      {childTasks.map(({ parent, task }) => (
        <article className="collection-card" key={task.id}>
          <button className="collection-open" onClick={() => onSelect(parent)}>
            <strong>{task.title}</strong>
            <span>{task.content || "내용 없음"}</span>
            <small>
              Todo · {parent.title} · {task.startDate || parent.startDate}
              {task.dueDate ? " → " + task.dueDate : ""}
              {task.completed ? " · 완료" : ""}
            </small>
          </button>
        </article>
      ))}
    </motion.section>
  );
}
