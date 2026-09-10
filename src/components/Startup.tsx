import { useEffect, useLayoutEffect, useState, type RefObject } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  type MotionValue,
} from "framer-motion";
import "../startup.css";

type Point = { x: number; y: number };
type Destination = Point & { kind: string; radius: number };
type Geometry = {
  width: number;
  height: number;
  source: Point;
  targets: Destination[];
};
const kinds = ["todo", "note", "task", "calendar"];
// Monotonic easing: a drop never travels past its final home-screen position.
const ease = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const between = (p: number, from: number, to: number) =>
  ease((p - from) / (to - from));

function Drop({
  progress,
  source,
  target,
  index,
}: {
  progress: MotionValue<number>;
  source: Point;
  target: Destination;
  index: number;
}) {
  const travel = (p: number) =>
    between(p, 0.31 + index * 0.014, 0.745 + index * 0.012);
  const x = useTransform(
    progress,
    (p) => source.x + (target.x - source.x) * travel(p),
  );
  const y = useTransform(
    progress,
    (p) => source.y + (target.y - source.y) * travel(p),
  );
  const radius = (p: number) => 28 + (target.radius - 28) * travel(p);
  const dx = target.x - source.x,
    dy = target.y - source.y;
  const horizontal = (dx * dx) / Math.max(1, dx * dx + dy * dy);
  const stretch = (p: number) =>
    1 + 0.3 * (horizontal * 2 - 1) * Math.sin(Math.PI * travel(p));
  const rx = useTransform(progress, (p) => radius(p) * stretch(p));
  const ry = useTransform(progress, (p) => radius(p) / stretch(p));
  const opacity = useTransform(
    progress,
    (p) => between(p, 0.285, 0.33) * (1 - between(p, 0.79, 0.955)),
  );
  return (
    <motion.g
      opacity={opacity}
      data-launch-target={target.kind}
      data-end-x={target.x}
      data-end-y={target.y}
    >
      <motion.ellipse cx={x} cy={y} rx={rx} ry={ry} fill="url(#launch-pearl)" />
    </motion.g>
  );
}

export default function Startup({
  stage,
  onReveal,
  onDone,
  quiet,
}: {
  stage: RefObject<HTMLDivElement>;
  onReveal: () => void;
  onDone: () => void;
  quiet: boolean;
}) {
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const [artReady, setArtReady] = useState(false);
  const progress = useMotionValue(0);
  useLayoutEffect(() => {
    const root = stage.current;
    if (!root) return;
    const measure = () => {
      const rect = root.getBoundingClientRect();
      const targets = kinds.flatMap((kind) => {
        const art = root.querySelector(`[data-target="${kind}"] .theo-art`);
        if (!art) return [];
        const b = art.getBoundingClientRect();
        return [
          {
            kind,
            x: b.x + b.width / 2 - rect.x,
            y: b.y + b.height / 2 - rect.y,
            radius: Math.min(b.width, b.height) / 2,
          },
        ];
      });
      if (targets.length !== 4) return;
      setGeometry({
        width: rect.width,
        height: rect.height,
        source: {
          x: rect.width / 2,
          y: targets[0].y + (targets[1].y - targets[0].y) * 0.58,
        },
        targets,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    root.querySelectorAll(".theo-anchor").forEach((el) => observer.observe(el));
    // Include position-only changes when the responsive layout switches.
    const mutations = new MutationObserver(measure);
    mutations.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [stage]);

  useEffect(() => {
    let alive = true;
    const ready = () => {
      if (alive) setArtReady(true);
    };
    const art = new Image();
    art.src = "/assets/theo-navigation.png";
    void art.decode().then(ready, ready);
    // Offline/failed artwork must never block entry or wait for data sync.
    const timeout = window.setTimeout(ready, 700);
    return () => {
      alive = false;
      clearTimeout(timeout);
    };
  }, []);

  const measured = Boolean(geometry);
  useEffect(() => {
    if (quiet) {
      onReveal();
      onDone();
      return;
    }
    if (!measured || !artReady) return;
    let revealed = false;
    progress.set(0);
    const playback = animate(progress, 1, {
      duration: 3.15,
      ease: "linear",
      onUpdate: (value) => {
        if (!revealed && value >= 0.785) {
          revealed = true;
          onReveal();
        }
      },
      onComplete: onDone,
    });
    return () => playback.stop();
  }, [artReady, measured, quiet, onReveal, onDone, progress]);

  const veil = useTransform(progress, (p) => 1 - between(p, 0.765, 0.925));
  const seedRadius = useTransform(
    progress,
    (p) => 37 * between(p, 0.015, 0.16) * (1 - between(p, 0.34, 0.55)),
  );
  const seedY = useTransform(progress, (p) =>
    geometry
      ? geometry.source.y +
        (geometry.height * 0.51 - geometry.source.y) *
          (1 - between(p, 0.035, 0.3))
      : 0,
  );
  const seedXRadius = useTransform(
    [progress, seedRadius],
    ([p, r]) =>
      Number(r) *
      (1 +
        0.16 *
          Math.sin((Number(p) / 0.3) * Math.PI * 2) *
          (1 - between(Number(p), 0.1, 0.31))),
  );
  const seedYRadius = useTransform(
    [progress, seedRadius],
    ([p, r]) =>
      Number(r) *
      (1 -
        0.13 *
          Math.sin((Number(p) / 0.3) * Math.PI * 2) *
          (1 - between(Number(p), 0.1, 0.31))),
  );
  const caption = useTransform(
    progress,
    (p) => between(p, 0.1, 0.24) * (1 - between(p, 0.51, 0.68)),
  );
  const shadow = useTransform(
    progress,
    (p) => 0.16 * between(p, 0.02, 0.16) * (1 - between(p, 0.23, 0.44)),
  );
  return (
    <div
      className="startup launch"
      role="dialog"
      aria-label="TEO 시작 화면"
      aria-modal="true"
    >
      <motion.div className="launch-veil" style={{ opacity: veil }} />
      {geometry && (
        <svg
          className="launch-liquid"
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="launch-pearl" cx="30%" cy="24%" r="78%">
              <stop offset="0" stopColor="#fff8eb" />
              <stop offset="0.28" stopColor="#f4dec0" />
              <stop offset="0.68" stopColor="#ddba91" />
              <stop offset="1" stopColor="#b98c68" />
            </radialGradient>
            <filter
              id="launch-liquid-join"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
              colorInterpolationFilters="sRGB"
            >
              <feGaussianBlur
                in="SourceGraphic"
                stdDeviation="3.5"
                result="soft"
              />
              <feColorMatrix
                in="soft"
                type="matrix"
                values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
                result="liquid"
              />
              <feComposite in="SourceGraphic" in2="liquid" operator="atop" />
            </filter>
            <filter id="launch-soft-shadow">
              <feGaussianBlur stdDeviation="7" />
            </filter>
          </defs>
          <motion.ellipse
            cx={geometry.source.x}
            cy={geometry.height * 0.54}
            rx="32"
            ry="6"
            fill="#a47b58"
            opacity={shadow}
            filter="url(#launch-soft-shadow)"
          />
          <g filter="url(#launch-liquid-join)">
            <motion.ellipse
              cx={geometry.source.x}
              cy={seedY}
              rx={seedXRadius}
              ry={seedYRadius}
              fill="url(#launch-pearl)"
            />
            {geometry.targets.map((target, index) => (
              <Drop
                key={target.kind}
                progress={progress}
                source={geometry.source}
                target={target}
                index={index}
              />
            ))}
          </g>
        </svg>
      )}
      <motion.div
        className="launch-caption"
        style={{ opacity: caption }}
        aria-hidden="true"
      >
        <strong>TEO</strong>
        <span>생각이 제자리를 찾는 순간</span>
      </motion.div>
      <motion.button
        className="skip-intro"
        style={{ opacity: veil }}
        onClick={() => {
          onReveal();
          onDone();
        }}
      >
        건너뛰기
      </motion.button>
    </div>
  );
}
