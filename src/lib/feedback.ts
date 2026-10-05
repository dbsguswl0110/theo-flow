export type BurstKind = "note" | "task" | "todo" | "calendar" | "done" | "love";

type Prefs = { haptics: boolean; sound: boolean };

const KEY = "teo-feedback";

function readPrefs(): Prefs {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { haptics: saved.haptics !== false, sound: saved.sound === true };
  } catch {
    return { haptics: true, sound: false };
  }
}

let prefs = readPrefs();
// Reduced-motion users get no particles or hopping either; set from the in-app "움직임 줄이기" switch.
let quiet = false;

export const getFeedbackPrefs = () => prefs;
export function setFeedbackPrefs(next: Prefs) {
  prefs = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage may be unavailable; the choice then lasts for this session */
  }
}
export const setFeedbackQuiet = (value: boolean) => {
  quiet = value;
};
export const isFeedbackQuiet = () => quiet;

function vibrate(pattern: number | number[]) {
  if (!prefs.haptics || quiet) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported (iOS) */
  }
}

let audio: AudioContext | null = null;
function tone(freq: number, delay: number, length: number, slideTo = freq, gain = 0.05) {
  if (!prefs.sound) return;
  try {
    audio ||= new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = audio.currentTime + delay;
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 1), now + length);
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + length);
    osc.connect(amp).connect(audio.destination);
    osc.start(now);
    osc.stop(now + length + 0.02);
  } catch {
    /* audio blocked until a gesture; ignore */
  }
}

export const feedback = {
  /** The swipe has gone far enough to be accepted if released now. */
  ready() {
    vibrate(8);
    tone(740, 0, 0.05, 980);
  },
  /** A memo landed in Note / Task / Todo. */
  land() {
    vibrate([12, 30, 18]);
    tone(420, 0, 0.09, 880);
    tone(660, 0.09, 0.11, 990, 0.04);
  },
  /** A task was checked off. */
  done() {
    vibrate([10, 24, 10, 24, 22]);
    tone(523, 0, 0.09);
    tone(659, 0.08, 0.09);
    tone(784, 0.16, 0.16, 784, 0.055);
  },
  /** TEO was petted. */
  pet() {
    vibrate(10);
    tone(880, 0, 0.06, 1200, 0.035);
    tone(1200, 0.07, 0.07, 1000, 0.03);
  },
};

export function burst(kind: BurstKind, x: number, y: number) {
  if (quiet) return;
  window.dispatchEvent(new CustomEvent("teo-burst", { detail: { kind, x, y } }));
}

/** Makes TEO cheer. Handled by App so every screen can trigger it. */
export function cheer() {
  window.dispatchEvent(new Event("teo-cheer"));
}

/** Confetti, buzz and a cheer from TEO at the middle of `element` (usually a checkbox). */
export function celebrate(element: Element) {
  const box = element.getBoundingClientRect();
  burst("done", box.left + box.width / 2, box.top + box.height / 2);
  feedback.done();
  cheer();
}
