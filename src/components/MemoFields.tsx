import type { DraftItem } from "../types";
export default function MemoFields({
  draft,
  onChange,
  onFocus,
  disabled = false,
}: {
  draft: DraftItem;
  onChange: (draft: DraftItem) => void;
  onFocus?: () => void;
  disabled?: boolean;
}) {
  return (
    <>
      <input
        aria-label="제목"
        className="memo-title"
        placeholder="Title"
        value={draft.title}
        disabled={disabled}
        onFocus={onFocus}
        onChange={(e) => onChange({ ...draft, title: e.target.value })}
      />
      <textarea
        aria-label="내용"
        className="memo-content"
        placeholder="생각을 적어보세요…"
        value={draft.content}
        disabled={disabled}
        onFocus={onFocus}
        onChange={(e) => onChange({ ...draft, content: e.target.value })}
      />
      <div className="memo-dates">
        <label>
          <span>Start date</span>
          <input
            aria-label="시작일"
            type="date"
            value={draft.startDate}
            disabled={disabled}
            onFocus={onFocus}
            onChange={(e) => onChange({ ...draft, startDate: e.target.value })}
          />
        </label>
        <div className="due-field">
          <label>
            <span>Due date</span>
            <select
              aria-label="마감일 방식"
              value={draft.dueDate === null ? "none" : "date"}
              disabled={disabled}
              onFocus={onFocus}
              onChange={(e) =>
                onChange({
                  ...draft,
                  dueDate: e.target.value === "none" ? null : draft.startDate,
                })
              }
            >
              <option value="none">None</option>
              <option value="date">날짜 지정</option>
            </select>
          </label>
          {draft.dueDate !== null && (
            <input
              aria-label="마감일"
              type="date"
              min={draft.startDate}
              value={draft.dueDate}
              disabled={disabled}
              onFocus={onFocus}
              onChange={(e) =>
                onChange({ ...draft, dueDate: e.target.value || null })
              }
            />
          )}
        </div>
      </div>
    </>
  );
}
