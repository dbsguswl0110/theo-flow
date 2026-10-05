import { motion } from "framer-motion";
import TheoArt, { TheoKind } from "./TheoArt";
export default function FloatingTheo({
  kind,
  label,
  className = "",
  onClick,
  quiet,
  accepted,
  pulse = 0,
  count = 0,
}: {
  kind: TheoKind;
  label: string;
  className?: string;
  onClick: () => void;
  quiet: boolean;
  accepted: boolean;
  /** Changes every time something lands here, so the catch animation restarts. */
  pulse?: number;
  /** Open items behind this icon; shown as a badge that bumps when it grows. */
  count?: number;
}) {
  const durations = {
    todo: 5.4,
    note: 6.1,
    task: 5.8,
    project: 6.4,
    calendar: 6.8,
  };
  return (
    <div className={`theo-anchor ${className}`} data-target={kind}>
      <motion.button
        type="button"
        className={`theo-button theo-${kind} ${accepted ? "accepted" : ""}`}
        onClick={onClick}
        aria-label={count > 0 ? `${label} ${count}개` : label}
        animate={
          quiet ? { x: 0, y: 0 } : { x: [0, 3, 0, -3, 0], y: [0, -3, 0, 3, 0] }
        }
        transition={{
          duration: quiet ? 0 : durations[kind],
          repeat: quiet ? 0 : Infinity,
          ease: "easeInOut",
        }}
        whileTap={{ scale: 0.88 }}
      >
        <span className="theo-art-wrap" key={accepted ? pulse : "rest"}>
          <TheoArt kind={kind} />
        </span>
        <span className="theo-label">{label}</span>
        {count > 0 && (
          <span className="theo-count" key={count} aria-hidden="true">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </motion.button>
    </div>
  );
}
