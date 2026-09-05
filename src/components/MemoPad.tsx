import { motion, PanInfo, useAnimationControls } from "framer-motion";
import { useEffect, useState } from "react";
import type { DraftItem, ItemType } from "../types";

type Props = {
  initialValue: DraftItem;
  focused: boolean;
  onFocus: () => void;
  onBlurFocus: () => void;
  onRegister: (type: ItemType, draft: DraftItem) => void;
};

const THRESHOLD = 90;

export default function MemoPad({
  initialValue,
  focused,
  onFocus,
  onBlurFocus,
  onRegister
}: Props) {
  const [draft, setDraft] = useState(initialValue);
  const controls = useAnimationControls();

  useEffect(() => {
    setDraft(initialValue);
  }, [initialValue]);

  const set = (key: keyof DraftItem, value: string | null) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  async function fly(type: ItemType) {
    const target =
      type === "note"
        ? { x: -240, y: -24, rotate: -7 }
        : type === "task"
        ? { x: 240, y: -24, rotate: 7 }
        : { x: 15, y: -290, rotate: 2 };

    await controls.start({
      ...target,
      scale: 0.42,
      opacity: 0,
      transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] }
    });

    onRegister(type, { ...draft, content: type === "todo" && draft.content.trim() ? draft.content : draft.content });

    setDraft({
      title: "",
      content: "",
      startDate: new Date().toISOString().slice(0, 10),
      dueDate: null
    });

    controls.set({ x: 0, y: 0, rotate: 0, scale: 0.72, opacity: 0 });
    await controls.start({
      scale: 1,
      opacity: 1,
      transition: { type: "spring", stiffness: 260, damping: 22 }
    });
  }

  async function onDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (info.offset.x < -THRESHOLD) return fly("note");
    if (info.offset.x > THRESHOLD) return fly("task");
    if (info.offset.y < -THRESHOLD) return fly("todo");

    controls.start({
      x: 0,
      y: 0,
      rotate: 0,
      transition: { type: "spring", stiffness: 300, damping: 24 }
    });
  }

  return (
    <motion.section
      className={`memo-pad ${focused ? "memo-pad--focused" : ""}`}
      animate={controls}
      drag={!focused}
      dragElastic={0.18}
      dragMomentum={false}
      onDragStart={onBlurFocus}
      onDragEnd={onDragEnd}
      onClick={() => {
        if (!focused) onFocus();
      }}
      whileHover={!focused ? { scale: 1.012 } : undefined}
    >
      <motion.div
        className="memo-inner"
        animate={!focused ? { scale: [1, 1.008, 1] } : { scale: 1 }}
        transition={!focused ? { duration: 4, repeat: Infinity, ease: "easeInOut" } : undefined}
      >
        <input
          className="memo-title"
          value={draft.title}
          placeholder="Title"
          onChange={(e) => set("title", e.target.value)}
          onFocus={onFocus}
        />

        <textarea
          className="memo-content"
          value={draft.content}
          placeholder="Write something..."
          onChange={(e) => set("content", e.target.value)}
          onFocus={onFocus}
        />

        <div className="memo-dates">
          <label>
            <span>Start</span>
            <input
              type="date"
              value={draft.startDate}
              onChange={(e) => set("startDate", e.target.value)}
              onFocus={onFocus}
            />
          </label>

          <label>
            <span>Due</span>
            <input
              type="date"
              value={draft.dueDate ?? ""}
              onChange={(e) => set("dueDate", e.target.value || null)}
              onFocus={onFocus}
            />
          </label>
        </div>

        {focused && (
          <button
            type="button"
            className="done-editing"
            onClick={(e) => {
              e.stopPropagation();
              onBlurFocus();
            }}
          >
            Done
          </button>
        )}
      </motion.div>
    </motion.section>
  );
}
