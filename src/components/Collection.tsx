import { motion } from "framer-motion";
import { useState } from "react";
import type { CaptureItem } from "../types";
export default function Collection({
  kind,
  items,
  onClose,
  onSelect,
  onSave,
  folders,
  onAddFolder,
}: {
  kind: string;
  items: CaptureItem[];
  onClose: () => void;
  onSelect: (i: CaptureItem) => void;
  onSave: (i: CaptureItem) => Promise<boolean>;
  folders: string[];
  onAddFolder: (name: string) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false),
    [folder, setFolder] = useState("*"),
    [adding, setAdding] = useState(false),
    [name, setName] = useState("");
  async function save(item: CaptureItem) {
    if (busy) return;
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
