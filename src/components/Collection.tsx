import { motion } from "framer-motion";
import { useState } from "react";
import type { CaptureItem } from "../types";
export default function Collection({
  kind,
  items,
  onClose,
  onSelect,
  onSave,
}: {
  kind: string;
  items: CaptureItem[];
  onClose: () => void;
  onSelect: (i: CaptureItem) => void;
  onSave: (i: CaptureItem) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  async function save(item: CaptureItem) {
    if (busy) return;
    setBusy(true);
    try { await onSave(item); } finally { setBusy(false); }
  }
  const title = (
    {
      note: "Note",
      task: "Task",
      project: "Project Todo",
      todos: "Todo",
      trash: "Trash",
    } as Record<string, string>
  )[kind];
  const visible = items.filter((i) =>
    kind === "trash"
      ? !!i.deletedAt
      : !i.deletedAt &&
        (kind === "project" || kind === "todos"
          ? i.type === "todo"
          : i.type === kind),
  );
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
        <span>{visible.length}</span>
      </header>
      <p className="muted">
        {kind === "todos"
          ? "프로젝트에 담긴 하위 할 일"
          : kind === "trash"
            ? "옮긴 항목은 여기에서 복원할 수 있어요."
            : "한 장의 생각이 모이는 곳"}
      </p>
      {visible.length === 0 && (
        <div className="empty-state">
          아직 비어 있어요.
          <br />
          <span>중앙 메모장에서 적고 스와이프해보세요.</span>
        </div>
      )}
      {visible.map((i) => (
        <article className="collection-card" key={i.id}>
          <button className="collection-open" onClick={() => onSelect(i)}>
            <strong>{i.title}</strong>
            <span>{i.content || "내용 없음"}</span>
            <small>
              {i.startDate} {i.dueDate ? "→ " + i.dueDate : "· 마감 없음"}
            </small>
          </button>
          {kind === "todos" && (
            <div className="collection-subtasks">
              {!i.subtasks?.length && (
                <p>프로젝트를 열어 할 일을 추가해주세요.</p>
              )}
              {i.subtasks?.map((s) => (
                <label key={s.id}>
                  <input
                    type="checkbox"
                    checked={s.completed}
                    disabled={busy}
                    onChange={(e) =>
                      void save({
                        ...i,
                        subtasks: i.subtasks?.map((t) =>
                          t.id === s.id
                            ? { ...t, completed: e.target.checked }
                            : t,
                        ),
                      })
                    }
                  />
                  {s.title}
                </label>
              ))}
            </div>
          )}
          {kind === "trash" && (
            <button
              className="secondary-btn"
              disabled={busy}
              onClick={() => void save({ ...i, deletedAt: null })}
            >
              복원
            </button>
          )}
        </article>
      ))}
    </motion.section>
  );
}
