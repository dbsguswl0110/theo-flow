import type { DraftItem } from "../types";
import { useEffect, useRef } from "react";
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
  const contentRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const textarea = contentRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 360)}px`;
  }, [draft.content]);
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
        ref={contentRef}
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
          <span>시작일</span>
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
            <span>마감일</span>
            <label className="due-toggle">
              <span>없음</span>
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
              <span>지정</span>
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
