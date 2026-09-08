import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { CaptureItem } from "../types";
import { deletePhotoRemote, uploadPhotoRemote } from "../lib/storage";
import MemoFields from "./MemoFields";

export default function ItemDetail({
  item,
  onClose,
  onSave,
  folders,
}: {
  item: CaptureItem;
  folders: string[];
  onClose: () => void;
  onSave: (item: CaptureItem) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(item);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function persist(next = draft, close = false) {
    if (
      !next.title.trim() ||
      !next.startDate ||
      next.subtasks?.some(
        (t) =>
          t.title.trim() &&
          t.dueDate &&
          t.dueDate < (t.startDate || next.startDate),
      ) ||
      (next.dueDate && next.dueDate < next.startDate)
    ) {
      setError("제목과 날짜를 확인해주세요. 마감일은 시작일 이후여야 해요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (await onSave(next)) {
        setDraft(next);
        setEditing(false);
        if (close) onClose();
      } else setError("저장하지 못했어요. 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <motion.section
      className="panel detail-screen"
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
    >
      <header className="panel-header">
        <button aria-label="상세 닫기" disabled={busy} onClick={onClose}>
          ←
        </button>
        <h1>
          {draft.type === "todo"
            ? "Todo"
            : draft.type === "note"
              ? "Note"
              : "Task"}
        </h1>
        <button
          disabled={busy || !!draft.deletedAt}
          onClick={() => {
            if (editing) setDraft(item);
            setEditing(!editing);
            setError("");
          }}
        >
          {editing ? "취소" : "Edit"}
        </button>
      </header>
      <div className="detail-memo memo-paper">
        <MemoFields
          draft={draft}
          disabled={!editing || busy}
          onChange={(fields) => setDraft({ ...draft, ...fields })}
        />
      </div>
      {draft.type === "note" && (
        <label className="folder-select">
          Folder
          <select
            aria-label="노트 폴더"
            value={draft.folder || ""}
            disabled={busy || !editing}
            onChange={(e) =>
              setDraft({ ...draft, folder: e.target.value || null })
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
      {draft.type !== "note" && (
        <label className="completion-row">
          <input
            type="checkbox"
            checked={!!draft.completed}
            disabled={busy || editing || !!draft.deletedAt}
            onChange={(e) =>
              void persist({ ...draft, completed: e.target.checked })
            }
          />
          완료
        </label>
      )}
      {draft.type === "todo" && (
        <section className="subtask-editor">
          <h2>Todo</h2>
          {!draft.subtasks?.length && (
            <p className="muted">Edit에서 Todo 안에 Task를 추가해보세요.</p>
          )}
          {draft.subtasks?.map((s) => (
            <details
              key={s.id}
              className="child-task"
              open={editing || undefined}
            >
              <summary>
                <input
                  type="checkbox"
                  aria-label={s.title + " 완료"}
                  checked={!!s.completed}
                  disabled={busy || !!draft.deletedAt}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const next = {
                      ...draft,
                      subtasks: draft.subtasks?.map((t) =>
                        t.id === s.id
                          ? { ...t, completed: e.target.checked }
                          : t,
                      ),
                    };
                    editing ? setDraft(next) : void persist(next);
                  }}
                />
                <span>{s.title || "새 Task"}</span>
              </summary>
              <div className="child-task-fields">
                <MemoFields
                  draft={{
                    title: s.title,
                    content: s.content || "",
                    startDate: s.startDate || draft.startDate,
                    dueDate: s.dueDate || null,
                  }}
                  disabled={!editing || busy}
                  onChange={(fields) =>
                    setDraft({
                      ...draft,
                      subtasks: draft.subtasks?.map((t) =>
                        t.id === s.id ? { ...t, ...fields } : t,
                      ),
                    })
                  }
                />
              </div>
              {editing && (
                <button
                  className="secondary-btn"
                  aria-label="Task 삭제"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      subtasks: draft.subtasks?.filter((t) => t.id !== s.id),
                    })
                  }
                >
                  Task 삭제
                </button>
              )}
            </details>
          ))}
          {editing && (
            <button
              className="secondary-btn"
              onClick={() =>
                setDraft({
                  ...draft,
                  subtasks: [
                    ...(draft.subtasks || []),
                    {
                      id: crypto.randomUUID(),
                      title: "",
                      completed: false,
                      content: "",
                      startDate: draft.startDate,
                      dueDate: null,
                    },
                  ],
                })
              }
            >
              + Task 추가
            </button>
          )}
        </section>
      )}
      {draft.type === "note" && (
        <section className="photo-section">
          <h2>Photos</h2>
          <div className="photo-grid">
            <AnimatePresence>
              {draft.photos?.map((photo) => {
                const id = typeof photo === "string" ? photo : photo.id;
                return (
                  <motion.div
                    className="photo-thumb"
                    key={id}
                    layout
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <img
                      src={
                        typeof photo === "string" ? photo : "/api/photos/" + id
                      }
                      alt="노트에 첨부한 사진"
                    />
                    {!draft.deletedAt && !editing && (
                      <button
                        aria-label="사진 삭제"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          setError("");
                          try {
                            if (typeof photo !== "string")
                              await deletePhotoRemote(id);
                            const next = {
                              ...draft,
                              photos: draft.photos?.filter(
                                (p) =>
                                  (typeof p === "string" ? p : p.id) !== id,
                              ),
                            };
                            setDraft(next);
                            await onSave(next);
                          } catch {
                            setError("사진을 삭제하지 못했어요.");
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        ×
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
          {!draft.deletedAt && !editing && (
            <label className="photo-add">
              {busy ? "처리 중…" : "+ 사진 첨부"}
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={busy}
                onChange={async (e) => {
                  const file = e.target.files?.[0],
                    input = e.target;
                  if (!file) return;
                  if (file.size > 10 * 1024 * 1024) {
                    setError("사진은 10MB 이하로 선택해주세요.");
                    input.value = "";
                    return;
                  }
                  setBusy(true);
                  setError("");
                  try {
                    const uploaded = await uploadPhotoRemote(draft.id, file);
                    const next = {
                      ...draft,
                      photos: [...(draft.photos || []), uploaded],
                    };
                    setDraft(next);
                    await onSave(next);
                  } catch {
                    setError(
                      "사진을 첨부하지 못했어요. 연결과 파일 형식을 확인해주세요.",
                    );
                  } finally {
                    setBusy(false);
                    input.value = "";
                  }
                }}
              />
            </label>
          )}
        </section>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="detail-actions">
        {editing && (
          <button
            disabled={busy}
            className="primary-btn"
            onClick={() =>
              void persist({
                ...draft,
                subtasks: draft.subtasks?.filter((s) => s.title.trim()),
              })
            }
          >
            {busy ? "저장 중…" : "저장"}
          </button>
        )}
        {!editing && (
          <button
            disabled={busy}
            className="secondary-btn"
            onClick={() =>
              void persist(
                {
                  ...draft,
                  deletedAt: draft.deletedAt ? null : new Date().toISOString(),
                },
                true,
              )
            }
          >
            {draft.deletedAt ? "복원" : "휴지통으로 이동"}
          </button>
        )}
      </div>
    </motion.section>
  );
}
