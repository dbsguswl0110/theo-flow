import { useEffect, useState, type RefObject } from "react";
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

// The launch is one timeline in seconds: a drop falls and lands as a pearl, then the pearl lets go of one bead
// per destination, each bead swinging into place. The only thing that changes the length is DURATION.
const DURATION = 2.8;
const FALL_START = 0.05;
const IMPACT = 0.62; // the drop touches down
const BEAD_START = 1.25; // the first bead leaves the pearl
const STAGGER = 0.07; // gap between one bead leaving and the next
const FLIGHT = 0.85;
const LAST_LAND = BEAD_START + STAGGER * (kinds.length - 1) + FLIGHT;
const SEED_R = 38; // radius of the resting pearl
const ARC = 0.2; // how far a bead's path bows out, as a share of its length

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
// Monotonic easing: a bead never travels past its final home-screen position.
const ease = (value: number) => {
  const t = clamp01(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const easeOut = (value: number) => 1 - Math.pow(1 - clamp01(value), 3);
// 0 before `from`, 1 after `to`, smooth in between (times in seconds).
const span = (s: number, from: number, to: number) => clamp01((s - from) / (to - from));
const between = (s: number, from: number, to: number) => ease(span(s, from, to));

/** The drop and pearl that start the launch: it falls, squashes on landing, springs back and swells. */
function seedShape(s: number, restY: number, fall: number) {
  const u = span(s, FALL_START, IMPACT);
  const fallR = 12 + 4 * u;
  const dropRx = fallR * 0.86;
  const dropRy = fallR * 1.22;

  const since = Math.max(0, s - IMPACT);
  const swell = between(s, IMPACT, IMPACT + 0.55);
  // The pearl hands itself over to the beads, so it shrinks away as they leave.
  const gather = between(s, BEAD_START + 0.05, BEAD_START + 0.75);
  const base = (16 + (SEED_R - 16) * swell) * (1 - gather);
  const wobble = Math.exp(-6 * since) * Math.cos(Math.PI * 2 * 2.4 * since);
  // It crouches a little just before the first bead leaves.
  const crouch = 0.1 * Math.sin(Math.PI * span(s, BEAD_START - 0.18, BEAD_START));
  const pearlRx = base * (1 + 0.34 * wobble + crouch * 0.6);
  const pearlRy = base * (1 - 0.34 * wobble - crouch);

  const landed = between(s, IMPACT - 0.04, IMPACT + 0.03);
  const rx = dropRx + (pearlRx - dropRx) * landed;
  const ry = dropRy + (pearlRy - dropRy) * landed;
  // The pearl sits on the ground, so squashing it moves its centre down; gravity pulls the drop in before that.
  const ground = restY + SEED_R;
  const y = (ground - ry) * (1 - gather) + restY * gather - fall * (1 - u * u);
  return { rx, ry, y, swell, ground };
}

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
  const start = BEAD_START + index * STAGGER;
  const end = start + FLIGHT;
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  // Every bead bows the same way, so the four of them swirl out like a pinwheel instead of flying in straight lines.
  const bowX = (source.x + target.x) / 2 - dy * ARC;
  const bowY = (source.y + target.y) / 2 + dx * ARC;
  const flight = (p: number) => span(p * DURATION, start, end);
  // Peels away from the pearl, picks up speed, then slows into place.
  const travel = (p: number) => {
    const u = flight(p);
    return 0.45 * easeOut(u) + 0.55 * ease(u);
  };
  const point = (p: number) => {
    const t = travel(p);
    const m = 1 - t;
    return {
      x: m * m * source.x + 2 * m * t * bowX + t * t * target.x,
      y: m * m * source.y + 2 * m * t * bowY + t * t * target.y,
    };
  };
  const x = useTransform(progress, (p) => point(p).x);
  const y = useTransform(progress, (p) => point(p).y);
  const radius = (p: number) => 26 + (target.radius - 26) * travel(p);
  // Stretch along the way it is heading, ease off, then squash a touch as it lands.
  const stretch = (p: number) => {
    const t = travel(p);
    const m = 1 - t;
    const vx = 2 * m * (bowX - source.x) + 2 * t * (target.x - bowX);
    const vy = 2 * m * (bowY - source.y) + 2 * t * (target.y - bowY);
    const horizontal = (vx * vx) / Math.max(1, vx * vx + vy * vy);
    const u = flight(p);
    const amount = 0.24 * Math.sin(Math.PI * Math.pow(u, 0.55)) - 0.1 * Math.sin(Math.PI * span(u, 0.85, 1));
    return 1 + amount * (horizontal * 2 - 1);
  };
  const rx = useTransform(progress, (p) => radius(p) * stretch(p));
  const ry = useTransform(progress, (p) => radius(p) / stretch(p));
  const opacity = useTransform(
    progress,
    (p) => between(p * DURATION, start - 0.02, start + 0.1) * (1 - between(p * DURATION, end, end + 0.3)),
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
  useEffect(() => {
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
    const poll = window.setInterval(measure, 100);
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    root.querySelectorAll(".theo-anchor").forEach((el) => observer.observe(el));
    // Include position-only changes when the responsive layout switches.
    const mutations = new MutationObserver(measure);
    mutations.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => {
      clearInterval(poll);
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
      duration: DURATION,
      ease: "linear",
      onUpdate: (value) => {
        // The home screen is handed over once the last bead has landed on its icon.
        if (!revealed && value * DURATION >= LAST_LAND) {
          revealed = true;
          onReveal();
        }
      },
      onComplete: onDone,
    });
    return () => playback.stop();
  }, [artReady, measured, quiet, onReveal, onDone, progress]);

  const veil = useTransform(
    progress,
    (p) => 1 - between(p * DURATION, LAST_LAND - 0.3, LAST_LAND + 0.45),
  );
  const fall = geometry ? Math.min(220, geometry.height * 0.3) : 0;
  const restY = geometry ? geometry.source.y : 0;
  const seedY = useTransform(progress, (p) => seedShape(p * DURATION, restY, fall).y);
  const seedXRadius = useTransform(progress, (p) => seedShape(p * DURATION, restY, fall).rx);
  const seedYRadius = useTransform(progress, (p) => seedShape(p * DURATION, restY, fall).ry);
  const seedOpacity = useTransform(progress, (p) => between(p * DURATION, 0, 0.14));
  const caption = useTransform(
    progress,
    (p) => between(p * DURATION, 0.7, 1.0) * (1 - between(p * DURATION, 1.55, 1.9)),
  );
  // The shadow grows as the drop nears the ground and goes when the beads leave.
  const shadow = useTransform(
    progress,
    (p) =>
      0.16 * between(p * DURATION, FALL_START, IMPACT) * (1 - between(p * DURATION, BEAD_START + 0.1, BEAD_START + 0.6)),
  );
  const shadowRadius = useTransform(progress, (p) => {
    const s = p * DURATION;
    return 12 + 22 * Math.min(1, 0.4 * span(s, FALL_START, IMPACT) + 0.6 * seedShape(s, restY, fall).swell);
  });
  // One soft ring spreads across the ground where the drop lands.
  const ring = useTransform(progress, (p) => span(p * DURATION, IMPACT, IMPACT + 0.75));
  const ringRx = useTransform(ring, (t) => 10 + 100 * easeOut(t));
  const ringRy = useTransform(ringRx, (r) => r * 0.24);
  const ringOpacity = useTransform(ring, (t) => (t <= 0 || t >= 1 ? 0 : 0.5 * (1 - t)));
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
            cy={geometry.source.y + SEED_R + 6}
            rx={shadowRadius}
            ry="6"
            fill="#a47b58"
            opacity={shadow}
            filter="url(#launch-soft-shadow)"
          />
          <motion.ellipse
            cx={geometry.source.x}
            cy={geometry.source.y + SEED_R + 2}
            rx={ringRx}
            ry={ringRy}
            fill="none"
            stroke="#c9a784"
            strokeWidth="1.6"
            opacity={ringOpacity}
          />
          <g filter="url(#launch-liquid-join)">
            <motion.ellipse
              cx={geometry.source.x}
              cy={seedY}
              rx={seedXRadius}
              ry={seedYRadius}
              fill="url(#launch-pearl)"
              opacity={seedOpacity}
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
