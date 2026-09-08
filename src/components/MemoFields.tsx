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
          <div className="due-heading">
            <span>Due date</span>
            <label className="due-toggle">
              <span>NONE</span>
              <input
                type="checkbox"
                role="switch"
                aria-label="마감일 사용"
                checked={draft.dueDate !== null}
                disabled={disabled}
                onChange={(e) =>
                  onChange({
                    ...draft,
                    dueDate: e.target.checked ? draft.startDate : null,
                  })
                }
              />
              <i aria-hidden="true" />
              <span>DUE</span>
            </label>
          </div>
          <input
            aria-label="마감일"
            type="date"
            min={draft.startDate}
            value={draft.dueDate || ""}
            disabled={disabled || draft.dueDate === null}
            onFocus={onFocus}
            onChange={(e) =>
              onChange({ ...draft, dueDate: e.target.value || draft.startDate })
            }
          />
        </div>
      </div>
    </>
  );
}
