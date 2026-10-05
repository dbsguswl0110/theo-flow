import { TEO_GROUPS } from "./teoSprites.generated";

type Group = keyof typeof TEO_GROUPS;
export type Step = { cell: number; ms: number };

const cell = (group: Group, index: number) => TEO_GROUPS[group].start + index;
const step = (group: Group, index: number, ms: number): Step => ({
  cell: cell(group, index),
  ms,
});

// Frame numbers refer to the order of frames inside each panel of the character sheet.
export const FRAME = {
  sit: cell("idle", 4),
  sitSparkle: cell("idle", 1),
  lookLeft: cell("look", 0),
  lookRight: cell("look", 1),
  sleepy: cell("sleep", 1),
  happy: cell("happy", 0),
  napping: cell("sleep", 5),
};

/** Frames where TEO lies curled up: low enough that the cushion would hide them, so he is lifted onto it. */
export const LOW_FRAMES = new Set<number>(
  [2, 3, 4, 5, 6].map((index) => cell("sleep", index)),
);

/** Calm sitting loop with slow blinks. */
export const IDLE: Step[] = [
  step("idle", 4, 2400),
  step("idle", 3, 140),
  step("idle", 4, 1500),
  step("idle", 5, 1800),
  step("idle", 6, 150),
  step("idle", 5, 1400),
  step("idle", 1, 1100),
  step("idle", 3, 150),
];

/** Small things TEO does now and then while idle. */
export const EXTRAS: Record<string, Step[]> = {
  scratch: [
    step("scratch", 0, 240),
    step("scratch", 1, 240),
    step("scratch", 0, 240),
    step("scratch", 1, 240),
    step("scratch", 0, 240),
    step("idle", 4, 300),
  ],
  lick: [
    step("lick", 0, 300),
    step("lick", 1, 320),
    step("lick", 0, 300),
    step("lick", 1, 320),
    step("lick", 2, 600),
    step("idle", 4, 300),
  ],
  yawn: [
    step("yawn", 0, 450),
    step("yawn", 1, 1100),
    step("yawn", 2, 600),
    step("idle", 4, 300),
  ],
  lookAround: [
    step("look", 0, 900),
    step("idle", 4, 300),
    step("look", 1, 900),
    step("idle", 4, 300),
  ],
};

/** Tongue-out cheer, repeated for as long as TEO is happy. */
export const HAPPY: Step[] = [
  step("happy", 0, 170),
  step("happy", 1, 170),
  step("happy", 2, 170),
  step("happy", 1, 170),
];

/** Nods off: yawn, lie down, curl up. */
export const FALL_ASLEEP: Step[] = [
  step("yawn", 1, 1000),
  step("sleep", 1, 600),
  step("sleep", 2, 600),
  step("sleep", 3, 600),
  step("sleep", 4, 700),
];

export const SLEEPING: Step[] = [step("sleep", 5, 1200), step("sleep", 6, 1200)];

/** Wakes up in reverse and perks up. */
export const WAKE_UP: Step[] = [
  step("sleep", 3, 150),
  step("sleep", 2, 150),
  step("sleep", 1, 180),
  step("sleep", 0, 220),
  step("idle", 1, 350),
];

/** Mini faces from the character sheet, used as small avatars (toasts, empty states). */
export const FACE = {
  smile: cell("faces", 0),
  tongue: cell("faces", 1),
  love: cell("faces", 3),
  sleepy: cell("faces", 4),
  surprised: cell("faces", 5),
};
