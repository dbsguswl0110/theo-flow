import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { BurstKind } from "../lib/feedback";

type Shape = "heart" | "star" | "spark" | "paw" | "bone" | "dot" | "bit";
type Item = { id: number; kind: BurstKind; x: number; y: number };

const PALETTE: Record<BurstKind, { shapes: Shape[]; colors: string[]; count: number }> = {
  note: { shapes: ["heart", "heart", "spark", "paw"], colors: ["#f08fa3", "#f7b5c2", "#ffd27a", "#c9926e"], count: 11 },
  task: { shapes: ["star", "spark", "spark", "paw"], colors: ["#78aee3", "#b7d5f5", "#ffd27a", "#c9926e"], count: 11 },
  todo: { shapes: ["star", "spark", "bone", "paw"], colors: ["#8cc48a", "#cde8c4", "#ffd27a", "#c9926e"], count: 11 },
  calendar: { shapes: ["spark", "star", "paw"], colors: ["#f2b27d", "#ffd27a", "#c9926e"], count: 9 },
  done: { shapes: ["bit", "bit", "dot", "star", "heart", "spark"], colors: ["#f08fa3", "#78aee3", "#8cc48a", "#ffd27a", "#f2a35e", "#b69be0"], count: 22 },
  love: { shapes: ["heart"], colors: ["#f08fa3", "#f7b5c2", "#ef7b92"], count: 6 },
};

function Glyph({ shape, color }: { shape: Shape; color: string }) {
  switch (shape) {
    case "heart":
      return <path fill={color} d="M12 21s-7.5-4.6-9.6-9.2C.8 8 3 4.5 6.4 4.5c2 0 3.6 1.1 4.6 2.7 1-1.6 2.6-2.7 4.6-2.7 3.4 0 5.6 3.5 4 7.3C19.5 16.4 12 21 12 21z" />;
    case "star":
      return <path fill={color} stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z" />;
    case "spark":
      return <path fill={color} d="M12 1.5c.9 5.2 2.5 8.1 10.5 10.5-8 2.4-9.6 5.3-10.5 10.5-.9-5.2-2.5-8.1-10.5-10.5 8-2.4 9.6-5.3 10.5-10.5z" />;
    case "paw":
      return (
        <g fill={color}>
          <ellipse cx="12" cy="16" rx="5.2" ry="4.2" />
          <circle cx="5.6" cy="10.4" r="2.3" />
          <circle cx="9.7" cy="6.4" r="2.4" />
          <circle cx="14.3" cy="6.4" r="2.4" />
          <circle cx="18.4" cy="10.4" r="2.3" />
        </g>
      );
    case "bone":
      return (
        <g fill={color}>
          <rect x="6" y="9.8" width="12" height="4.4" rx="2" />
          <circle cx="5.8" cy="9.6" r="2.6" />
          <circle cx="5.8" cy="14.4" r="2.6" />
          <circle cx="18.2" cy="9.6" r="2.6" />
          <circle cx="18.2" cy="14.4" r="2.6" />
        </g>
      );
    case "dot":
      return <circle cx="12" cy="12" r="5" fill={color} />;
    default:
      return <rect x="9" y="3" width="6" height="18" rx="2" fill={color} />;
  }
}

function Burst({ kind, x, y }: Omit<Item, "id">) {
  const { shapes, colors, count } = PALETTE[kind];
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.7;
        const reach = (kind === "done" ? 70 : 52) + Math.random() * (kind === "done" ? 70 : 38);
        return {
          shape: shapes[i % shapes.length],
          color: colors[(i * 7 + Math.floor(Math.random() * 3)) % colors.length],
          dx: Math.cos(angle) * reach,
          dy: Math.sin(angle) * reach - (kind === "love" ? 36 : 10),
          size: (kind === "done" ? 11 : 15) + Math.random() * 9,
          spin: (Math.random() - 0.5) * 240,
          delay: Math.random() * 0.06,
        };
      }),
    [count, colors, kind, shapes],
  );
  return (
    <div className="burst" style={{ left: x, top: y }}>
      <span className={`burst-ring burst-ring-${kind}`} />
      {pieces.map((p, i) => (
        <motion.svg
          key={i}
          className="burst-piece"
          viewBox="0 0 24 24"
          width={p.size}
          height={p.size}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
          animate={{
            x: [0, p.dx * 0.8, p.dx],
            y: [0, p.dy * 0.8 - 8, p.dy + 34],
            scale: [0, 1.2, 0.7],
            opacity: [1, 1, 0],
            rotate: p.spin,
          }}
          transition={{ duration: 0.95, delay: p.delay, ease: "easeOut", times: [0, 0.45, 1] }}
        >
          <Glyph shape={p.shape} color={p.color} />
        </motion.svg>
      ))}
    </div>
  );
}

/** Celebration particles. Fire them with `burst()` from lib/feedback; coordinates are viewport pixels. */
export default function BurstLayer({ quiet }: { quiet: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    let next = 0;
    const show = (event: Event) => {
      if (quiet) return;
      const detail = (event as CustomEvent<Omit<Item, "id">>).detail;
      const id = ++next;
      setItems((current) => [...current.slice(-5), { id, ...detail }]);
      window.setTimeout(() => setItems((current) => current.filter((i) => i.id !== id)), 1500);
    };
    window.addEventListener("teo-burst", show);
    return () => window.removeEventListener("teo-burst", show);
  }, [quiet]);
  return (
    <div className="burst-layer" aria-hidden="true">
      {items.map(({ id, ...item }) => (
        <Burst key={id} {...item} />
      ))}
    </div>
  );
}
