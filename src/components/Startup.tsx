import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import TheoArt from "./TheoArt";
export default function Startup({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const split = window.setTimeout(() => setPhase(1), 1250);
    const faces = window.setTimeout(() => setPhase(2), 2850);
    const done = window.setTimeout(onDone, 3800);
    return () => {
      clearTimeout(split);
      clearTimeout(faces);
      clearTimeout(done);
    };
  }, [onDone]);
  return (
    <motion.div
      className={`startup phase-${phase}`}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <svg width="0" height="0" aria-hidden="true">
        <defs>
          <filter id="jelly-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
            />
          </filter>
        </defs>
      </svg>
      <div className="jelly-field" aria-hidden="true">
        <div className="jelly-seed" />
        {["up", "left", "right", "down"].map((d) => (
          <div key={d} className={`jelly-drop drop-${d}`} />
        ))}
      </div>
      {["up", "left", "right", "down"].map((d) => (
        <div key={d} className={`startup-face face-${d}`}>
          <TheoArt kind="todo" face />
        </div>
      ))}
      <div className="startup-caption">
        <strong>TEO</strong>
        <span>Write · Swipe · Organise</span>
      </div>
      <button className="skip-intro" onClick={onDone}>
        건너뛰기
      </button>
    </motion.div>
  );
}
