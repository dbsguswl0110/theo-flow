import { motion, useMotionValue, useTransform } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { feedback } from "../lib/feedback";

export type SwipeAction = {
  label: string;
  icon: ReactNode;
  /** CSS colour of the revealed background. */
  color: string;
  run: (row: HTMLElement) => void;
};

const COMMIT = 92;

/**
 * A row that can be swiped like the memo pad: right and left each reveal an action, and releasing past the
 * threshold performs it. Rows spring back otherwise. Every action also exists as a plain button elsewhere.
 */
export default function SwipeRow({
  children,
  right,
  left,
  disabled,
}: {
  children: ReactNode;
  right?: SwipeAction;
  left?: SwipeAction;
  disabled?: boolean;
}) {
  const x = useMotionValue(0);
  const rowRef = useRef<HTMLDivElement>(null);
  const reachedRef = useRef(false);
  const draggedRef = useRef(false);
  const rightShow = useTransform(x, [0, 28, COMMIT], [0, 0.6, 1]);
  const leftShow = useTransform(x, [-COMMIT, -28, 0], [1, 0.6, 0]);
  const rightPop = useTransform(x, [0, COMMIT, COMMIT + 40], [0.7, 1, 1.18]);
  const leftPop = useTransform(x, [-COMMIT - 40, -COMMIT, 0], [1.18, 1, 0.7]);
  if (disabled || (!right && !left)) return <div className="swipe-row">{children}</div>;
  return (
    <div className="swipe-row" ref={rowRef}>
      {right && (
        <motion.div className="swipe-action swipe-action-right" style={{ background: right.color, opacity: rightShow }} aria-hidden="true">
          <motion.span style={{ scale: rightPop }}>{right.icon}</motion.span>
          <b>{right.label}</b>
        </motion.div>
      )}
      {left && (
        <motion.div className="swipe-action swipe-action-left" style={{ background: left.color, opacity: leftShow }} aria-hidden="true">
          <b>{left.label}</b>
          <motion.span style={{ scale: leftPop }}>{left.icon}</motion.span>
        </motion.div>
      )}
      <motion.div
        className="swipe-front"
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragSnapToOrigin
        dragElastic={0.32}
        dragConstraints={{ left: left ? -150 : 0, right: right ? 150 : 0 }}
        // A drag ends with a click on whatever was under the pointer; do not let that open the card.
        onClickCapture={(event) => {
          if (draggedRef.current) {
            event.stopPropagation();
            event.preventDefault();
          }
        }}
        onDragStart={() => {
          draggedRef.current = true;
        }}
        onDrag={(_, info) => {
          const reached = (info.offset.x > COMMIT && !!right) || (info.offset.x < -COMMIT && !!left);
          if (reached !== reachedRef.current) {
            reachedRef.current = reached;
            if (reached) feedback.ready();
          }
        }}
        onDragEnd={(_, info) => {
          reachedRef.current = false;
          window.setTimeout(() => {
            draggedRef.current = false;
          }, 0);
          const row = rowRef.current;
          if (!row) return;
          if (info.offset.x > COMMIT && right) right.run(row);
          else if (info.offset.x < -COMMIT && left) left.run(row);
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
