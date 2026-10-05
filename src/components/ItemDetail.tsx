import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { CaptureItem } from "../types";
import { deletePhotoRemote, uploadPhotoRemote } from "../lib/storage";
import MemoFields from "./MemoFields";
import { ScreenHeader, TrashIcon, UndoIcon } from "./ui";
import { deadlineColor, deadlineProgress } from "../lib/deadlineColor";
import { dayKey } from "../lib/dates";
import { celebrate } from "../lib/feedback";

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
  async function persist(next = draft, close = false): Promise<boolean> {
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
      return false;
    }
    setBusy(true);
    setError("");
    try {
      if (await onSave(next)) {
        setDraft(next);
        setEditing(false);
        if (close) onClose();
        return true;
      }
      setError("저장하지 못했어요. 다시 시도해주세요.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <motion.section
      className={`panel tc-screen detail-screen tone-${draft.type}`}
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20, pointerEvents: "none" as const, transition: { duration: 0.18, ease: "easeIn" } }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
    >
      <ScreenHeader
        title={draft.type === "todo" ? "Todo" : draft.type === "note" ? "Note" : "Task"}
        subtitle={
          draft.deletedAt
            ? "휴지통에 있어요. 복원하면 돌아와요"
            : draft.type === "todo"
              ? "Task로 쪼개서 하나씩 끝내요"
              : draft.type === "task"
                ? "끝내면 TEO가 좋아해요"
                : "TEO가 물어 온 생각"
        }
        tone={draft.type}
        backLabel="상세 닫기"
        onBack={onClose}
        disabled={busy}
        actions={
          <button
            type="button"
            className={`tc-soft-btn ${editing ? "is-on" : ""}`}
            disabled={busy || !!draft.deletedAt}
            onClick={() => {
              if (editing) setDraft(item);
              setEditing(!editing);
              setError("");
            }}
          >
            {editing ? "취소" : "Edit"}
          </button>
        }
      />
      <div className="detail-memo memo-paper">
        <MemoFields
          draft={draft}
          disabled={!editing || busy}
          onChange={(fields) => setDraft({ ...draft, ...fields })}
        />
      </div>
      {draft.type !== "note" && draft.dueDate && (
        <DeadlineCard startDate={draft.startDate} dueDate={draft.dueDate} completed={!!draft.completed} />
      )}
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
            onChange={(e) => {
              const box = e.currentTarget;
              const completed = e.target.checked;
              void persist({ ...draft, completed }).then((saved) => {
                if (saved && completed) celebrate(box);
              });
            }}
          />
          완료
        </label>
      )}
      {draft.type === "todo" && (
        <section className="subtask-editor">
          <h2>
            Task
            {!!draft.subtasks?.length && (
              <small>
                {draft.subtasks.filter((t) => t.completed).length}/{draft.subtasks.length}
              </small>
            )}
          </h2>
          {!!draft.subtasks?.length && (
            <i className="tc-progress" aria-hidden="true">
              <b
                style={{
                  width: `${(draft.subtasks.filter((t) => t.completed).length / draft.subtasks.length) * 100}%`,
                }}
              />
            </i>
          )}
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
                    if (editing) setDraft(next);
                    else {
                      const box = e.currentTarget;
                      const completed = e.target.checked;
                      void persist(next).then((saved) => {
                        if (saved && completed) celebrate(box);
                      });
                    }
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
            className={`secondary-btn tc-trash-btn ${draft.deletedAt ? "is-restore" : ""}`}
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
            {draft.deletedAt ? <UndoIcon /> : <TrashIcon />}
            {draft.deletedAt ? "복원" : "휴지통으로 이동"}
          </button>
        )}
      </div>
    </motion.section>
  );
}

function DeadlineCard({
  startDate,
  dueDate,
  completed,
}: {
  startDate: string;
  dueDate: string;
  completed: boolean;
}) {
  const progress = completed ? 0 : deadlineProgress(startDate, dueDate);
  const left = Math.round(
    (new Date(`${dueDate}T00:00:00`).getTime() - new Date(`${dayKey()}T00:00:00`).getTime()) / 86400000,
  );
  const text = completed
    ? "끝냈어요! 멋져요"
    : left < 0
      ? `마감이 ${-left}일 지났어요`
      : left === 0
        ? "오늘이 마감이에요"
        : `마감까지 ${left}일 남았어요`;
  return (
    <div className={`tc-deadline-card ${completed ? "is-done" : ""}`}>
      <span>{text}</span>
      <i aria-hidden="true">
        <b
          style={{
            width: `${completed ? 100 : Math.max(progress, 0.04) * 100}%`,
            background: completed ? "#8cc48a" : deadlineColor(progress),
          }}
        />
      </i>
    </div>
  );
}
