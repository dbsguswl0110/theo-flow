import {
  motion,
  PanInfo,
  useAnimationControls,
  useDragControls,
  useMotionValue,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { DraftItem, ItemType } from "../types";
import { emptyDraft } from "../lib/dates";
import MemoFields from "./MemoFields";

export default function MemoPad({
  focused,
  onFocus,
  onBlurFocus,
  onRegister,
  quiet,
  active,
}: {
  focused: boolean;
  onFocus: () => void;
  onBlurFocus: () => void;
  onRegister: (type: ItemType, draft: DraftItem) => Promise<boolean>;
  quiet: boolean;
  active: boolean;
}) {
  const [draft, setDraft] = useState<DraftItem>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const locked = useRef(false);
  const anchor = useRef<HTMLDivElement>(null);
  const controls = useAnimationControls();
  const dragControls = useDragControls();
  const x = useMotionValue(0),
    y = useMotionValue(0);
  useEffect(() => {
    void controls.start({
      scale: active ? 1 : 0,
      opacity: active ? 1 : 0,
      transition: { duration: quiet ? 0.1 : 0.45 },
    });
  }, [controls, active, quiet]);

  function returnHome() {
    return controls.start({
      x: 0,
      y: 0,
      scale: 1,
      rotate: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 330, damping: 28 },
    });
  }
  async function send(type: ItemType) {
    if (locked.current) return;
    if (
      !draft.title.trim() ||
      !draft.startDate ||
      (draft.dueDate && draft.dueDate < draft.startDate)
    ) {
      setError(
        !draft.title.trim()
          ? "제목을 먼저 적어주세요."
          : "시작일과 마감일을 확인해주세요.",
      );
      await returnHome();
      return;
    }
    locked.current = true;
    setBusy(true);
    setError("");
    // A directional throw, not a drop target: the icon does not need to be hit.
    const distance = Math.max(260, (anchor.current?.clientWidth || 220) * 1.4);
    const tx =
      type === "todo" ? x.get() * 0.25 : type === "note" ? -distance : distance;
    const ty = type === "todo" ? -distance : y.get() - 35;
    await controls.start({
      x: [x.get(), (x.get() + tx) / 2, tx],
      y: [y.get(), (y.get() + ty) / 2 - 45, ty],
      rotate: type === "note" ? -9 : 9,
      scale: [1, 0.68, 0.05],
      opacity: [1, 1, 0],
      transition: {
        duration: quiet ? 0.12 : 0.48,
        times: [0, 0.5, 1],
        ease: "easeInOut",
      },
    });
    try {
      if (!(await onRegister(type, draft))) throw new Error("save");
      setDraft(emptyDraft());
      onBlurFocus();
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
      controls.set({ x: 0, y: 0, rotate: 0, scale: 0, opacity: 0 });
      await controls.start({
        scale: 1,
        opacity: 1,
        transition: { duration: quiet ? 0.1 : 0.4 },
      });
    } catch {
      setError("저장하지 못했어요. 내용은 남아 있습니다. 다시 보내주세요.");
      await returnHome();
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  function directionFor(info: PanInfo): ItemType | null {
    const { x: dx, y: dy } = info.offset;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 65) return null;
    return Math.abs(dy) > Math.abs(dx)
      ? dy < 0
        ? "todo"
        : null
      : dx < 0
        ? "note"
        : "task";
  }
  return (
    <div ref={anchor} className={`memo-anchor ${focused ? "is-focused" : ""}`}>
      <motion.section
        className="memo-pad"
        initial={{ scale: 0, opacity: 0 }}
        animate={controls}
        style={{ x, y }}
        drag={!busy}
        dragListener={false}
        dragControls={dragControls}
        dragMomentum={false}
        onPointerDown={(e) => {
          pointerStart.current = { x: e.clientX, y: e.clientY };
          if (
            !busy &&
            !(e.target as HTMLElement).closest("input,textarea,select,button")
          )
            dragControls.start(e);
        }}
        onPointerUp={(e) => {
          const start = pointerStart.current;
          pointerStart.current = null;
          if (
            start &&
            Math.hypot(e.clientX - start.x, e.clientY - start.y) < 8 &&
            !busy &&
            !(e.target as HTMLElement).closest("input,textarea,select,button")
          ) {
            anchor.current
              ?.querySelector<HTMLInputElement>(".memo-title")
              ?.focus();
          }
        }}
        onDragEnd={(_, info) => {
          const type = directionFor(info);
          if (type) void send(type);
          else void returnHome();
        }}
      >
        <div className="memo-inner">
          <div
            className="memo-handle"
            role="button"
            tabIndex={0}
            aria-label="메모 스와이프 손잡이"
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") void send("note");
              if (e.key === "ArrowRight") void send("task");
              if (e.key === "ArrowUp") void send("todo");
            }}
          >
            <i />
            <span className="sr-only">
              {busy ? "저장 중" : "메모를 작성하고 원하는 방향으로 보내세요"}
            </span>
            <i />
          </div>
          <MemoFields
            draft={draft}
            onChange={setDraft}
            onFocus={onFocus}
            disabled={busy}
          />
          <label className="compose-photo-add">
            {draft.photo ? `📷 ${draft.photo.name}` : "＋ 사진 첨부 (선택)"}
            <input
              type="file"
              accept="image/*"
              hidden
              disabled={busy}
              onChange={(e) => setDraft((prev) => ({ ...prev, photo: e.target.files?.[0] || null }))}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {focused && (
            <button
              className="done-editing"
              onClick={() => {
                if (document.activeElement instanceof HTMLElement)
                  document.activeElement.blur();
                onBlurFocus();
              }}
            >
              완료
            </button>
          )}
        </div>
      </motion.section>
    </div>
  );
}
