import { motion } from "framer-motion";
import TheoArt, { TheoKind } from "./TheoArt";
export default function FloatingTheo({
  kind,
  label,
  className = "",
  onClick,
  quiet,
  accepted,
}: {
  kind: TheoKind;
  label: string;
  className?: string;
  onClick: () => void;
  quiet: boolean;
  accepted: boolean;
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
        className={`theo-button ${accepted ? "accepted" : ""}`}
        onClick={onClick}
        aria-label={label}
        animate={
          quiet ? { x: 0, y: 0 } : { x: [0, 3, 0, -3, 0], y: [-3, 0, 3, 0, -3] }
        }
        transition={{
          duration: durations[kind],
          repeat: Infinity,
          ease: "linear",
        }}
        whileTap={{ scale: 0.9 }}
      >
        <TheoArt kind={kind} />
        <span className="theo-label">{label}</span>
        {accepted && <span className="accepted-mark">✓</span>}
      </motion.button>
    </div>
  );
}
