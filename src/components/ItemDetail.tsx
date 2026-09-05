import { motion } from "framer-motion";
import { useState } from "react";
import type { CaptureItem } from "../types";
import { deletePhotoRemote, uploadPhotoRemote } from "../lib/storage";

type Props = {
  item: CaptureItem;
  onClose: () => void;
  onSave: (item: CaptureItem) => void;
};

export default function ItemDetail({ item, onClose, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item);
  const [photoBusy, setPhotoBusy] = useState(false);

  return (
    <motion.section
      className="detail-screen"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 18 }}
    >
      <header className="detail-header">
        <button type="button" onClick={onClose}>←</button>
        <span className="detail-type">{draft.type}</span>
      </header>

      {editing ? (
        <div className="detail-edit-card">
          <input
            className="memo-title"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
          <textarea
            className="memo-content"
            value={draft.content}
            onChange={(e) => setDraft({ ...draft, content: e.target.value })}
          />
          <div className="memo-dates">
            <label>
              <span>Start</span>
              <input
                type="date"
                value={draft.startDate}
                onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
              />
            </label>
            <label>
              <span>Due</span>
              <input
                type="date"
                value={draft.dueDate ?? ""}
                onChange={(e) => setDraft({ ...draft, dueDate: e.target.value || null })}
              />
            </label>
          </div>
          <button
            type="button"
            className="primary-btn"
            onClick={() => {
              onSave({ ...draft, updatedAt: new Date().toISOString() });
              setEditing(false);
            }}
          >
            Save
          </button>
          {draft.type === "todo" && <div className="subtask-editor"><h3>Project items</h3>{(draft.subtasks ?? []).map((subtask, index) => <label key={subtask.id} className="subtask-row"><input type="checkbox" checked={subtask.completed} onChange={(event) => setDraft({ ...draft, subtasks: (draft.subtasks ?? []).map((entry, i) => i === index ? { ...entry, completed: event.target.checked } : entry) })} /><input value={subtask.title} onChange={(event) => setDraft({ ...draft, subtasks: (draft.subtasks ?? []).map((entry, i) => i === index ? { ...entry, title: event.target.value } : entry) })} /></label>)}<button type="button" className="add-subtask" onClick={() => setDraft({ ...draft, subtasks: [...(draft.subtasks ?? []), { id: crypto.randomUUID(), title: "", completed: false }] })}>+ Add item</button></div>}
        </div>
      ) : (
        <>
          <h1>{draft.title || "Untitled"}</h1>
          <div className="detail-divider" />
          <p className="detail-content">{draft.content || "No content"}</p>

          <dl className="detail-meta">
            <div>
              <dt>Start</dt>
              <dd>{draft.startDate}</dd>
            </div>
            <div>
              <dt>Due</dt>
              <dd>{draft.dueDate ?? "None"}</dd>
            </div>
          </dl>

          {draft.type === "todo" && (
            <section className="subtasks">
              <h2>Project Todo</h2>
              {(draft.subtasks ?? []).length === 0 && <p>No subtasks yet.</p>}
            </section>
          )}

          {draft.type === "note" && (
            <section className="photo-placeholder">
              <h2>Photos</h2>
              <div className="photo-grid">
                {(draft.photos ?? []).map((photo) => {
                  const id = typeof photo === "string" ? photo : photo.id;
                  const src = typeof photo === "string" ? photo : `/api/photos/${photo.id}`;
                  return <div className="photo-thumb" key={id}><img src={src} alt="Attached note" /><button type="button" aria-label="Delete photo" onClick={async () => { if (typeof photo !== "string") await deletePhotoRemote(photo.id); setDraft((current) => ({ ...current, photos: (current.photos ?? []).filter((p) => (typeof p === "string" ? p : p.id) !== id) })); }}>×</button></div>;
                })}
              </div>
              <label className="photo-add">{photoBusy ? "Uploading…" : "+ Add Photo"}<input type="file" accept="image/*" hidden disabled={photoBusy} onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setPhotoBusy(true); try { const uploaded = await uploadPhotoRemote(draft.id, file); setDraft((current) => ({ ...current, photos: [...(current.photos ?? []), { id: uploaded.id, fileName: uploaded.fileName }] })); } finally { setPhotoBusy(false); event.target.value = ""; } }} /></label>
            </section>
          )}

          <button type="button" className="edit-btn" onClick={() => setEditing(true)}>
            Edit
          </button>
        </>
      )}
    </motion.section>
  );
}
