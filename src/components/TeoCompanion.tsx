import { useCallback, useEffect, useRef, useState } from "react";
import TeoSprite from "./TeoSprite";
import {
  EXTRAS,
  FALL_ASLEEP,
  FRAME,
  HAPPY,
  IDLE,
  LOW_FRAMES,
  SLEEPING,
  WAKE_UP,
  type Step,
} from "../lib/teoSprites";
import { burst, cheer, feedback } from "../lib/feedback";
import type { ItemType } from "../types";

const SIZE = 108;
const SLEEP_AFTER_MS = 24000;

type Mood = "idle" | "happy" | "look" | "sleep";

/**
 * TEO sits behind the top edge of the memo pad. He blinks and fidgets, follows a swipe with his eyes,
 * cheers when something is saved, dozes off when nobody touches the screen and hops awake when they do.
 */
export default function TeoCompanion({
  active,
  quiet,
  look,
  ready,
  cheerKey,
}: {
  active: boolean;
  quiet: boolean;
  look: ItemType | null;
  ready: boolean;
  cheerKey: number;
}) {
  const [frame, setFrame] = useState(FRAME.sit);
  const [asleep, setAsleep] = useState(false);
  const [cheering, setCheering] = useState(false);
  const timer = useRef<number>();
  const wasAsleep = useRef(false);
  const lastTouch = useRef(Date.now());
  const root = useRef<HTMLDivElement>(null);

  const play = useCallback((steps: Step[], loop = false, onDone?: () => void) => {
    window.clearTimeout(timer.current);
    let index = 0;
    const tick = () => {
      setFrame(steps[index].cell);
      timer.current = window.setTimeout(() => {
        index += 1;
        if (index >= steps.length) {
          if (!loop) {
            onDone?.();
            return;
          }
          index = 0;
        }
        tick();
      }, steps[index].ms);
    };
    tick();
  }, []);

  // Any touch wakes him; a long quiet spell sends him to sleep.
  useEffect(() => {
    if (quiet || !active) return;
    const touch = () => {
      lastTouch.current = Date.now();
      setAsleep(false);
    };
    const events = ["pointerdown", "keydown", "touchstart", "wheel"] as const;
    events.forEach((name) => window.addEventListener(name, touch, { passive: true }));
    const watch = window.setInterval(() => {
      if (Date.now() - lastTouch.current > SLEEP_AFTER_MS) setAsleep(true);
    }, 2000);
    return () => {
      events.forEach((name) => window.removeEventListener(name, touch));
      window.clearInterval(watch);
    };
  }, [active, quiet]);

  useEffect(() => {
    if (cheerKey === 0 || quiet) return;
    setCheering(true);
    const done = window.setTimeout(() => setCheering(false), 1900);
    return () => window.clearTimeout(done);
  }, [cheerKey, quiet]);

  useEffect(() => {
    if (!active || quiet) {
      window.clearTimeout(timer.current);
      setFrame(FRAME.sit);
      return;
    }
    if (asleep) {
      wasAsleep.current = true;
      play(FALL_ASLEEP, false, () => play(SLEEPING, true));
      return () => window.clearTimeout(timer.current);
    }
    if (cheering || ready) {
      play(HAPPY, true);
      return () => window.clearTimeout(timer.current);
    }
    if (look) {
      window.clearTimeout(timer.current);
      setFrame(
        look === "note" ? FRAME.lookLeft : look === "task" ? FRAME.lookRight : FRAME.sitSparkle,
      );
      return;
    }
    let extra: number | undefined;
    const idle = () => play(IDLE, true);
    const scheduleExtra = () => {
      extra = window.setTimeout(() => {
        const names = Object.keys(EXTRAS);
        const pick = EXTRAS[names[Math.floor(Math.random() * names.length)]];
        play(pick, false, () => {
          idle();
          scheduleExtra();
        });
      }, 7000 + Math.random() * 8000);
    };
    if (wasAsleep.current) {
      wasAsleep.current = false;
      play(WAKE_UP, false, idle);
    } else idle();
    scheduleExtra();
    return () => {
      window.clearTimeout(timer.current);
      window.clearTimeout(extra);
    };
  }, [active, quiet, asleep, cheering, ready, look, play]);

  const pet = () => {
    const box = root.current?.getBoundingClientRect();
    if (box) burst("love", box.left + box.width * 0.5, box.top + box.height * 0.28);
    feedback.pet();
    cheer();
  };

  const mood: Mood = asleep ? "sleep" : cheering || ready ? "happy" : look ? "look" : "idle";
  return (
    <div
      ref={root}
      className={`teo-companion ${active ? "" : "is-away"}`}
      data-mood={mood}
      data-look={look || undefined}
      data-low={LOW_FRAMES.has(frame) || undefined}
    >
      <button type="button" className="teo-pet" onClick={pet} aria-label="TEO 쓰다듬기">
        <TeoSprite cell={frame} size={SIZE} />
      </button>
    </div>
  );
}
