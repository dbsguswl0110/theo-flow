import { motion } from "framer-motion";

type Props = {
  label: "TODO" | "NOTE" | "TASK" | "CALENDAR";
  className?: string;
  onClick?: () => void;
};

const positions = {
  TODO: "0% 0%",
  NOTE: "100% 0%",
  TASK: "0% 100%",
  CALENDAR: "100% 100%"
};

const durations = {
  TODO: 4.6,
  NOTE: 5.2,
  TASK: 4.9,
  CALENDAR: 5.5
};

export default function FloatingTheo({ label, className = "", onClick }: Props) {
  return (
    <motion.button
      type="button"
      className={`theo-button ${className}`}
      onClick={onClick}
      aria-label={label}
      animate={{ y: [0, -5, 2, 0], rotate: [0, 0.8, -0.4, 0] }}
      transition={{
        duration: durations[label],
        repeat: Infinity,
        ease: "easeInOut"
      }}
      whileTap={{ scale: 0.92 }}
    >
      <span
        className="theo-sprite"
        style={{ backgroundPosition: positions[label] }}
      />
      <span className="theo-label">{label}</span>
    </motion.button>
  );
}
