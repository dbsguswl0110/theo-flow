function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
}

function mix(a: string, b: string, t: number) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const p = clamp(t);
  const r = Math.round(ca.r + (cb.r - ca.r) * p);
  const g = Math.round(ca.g + (cb.g - ca.g) * p);
  const bl = Math.round(ca.b + (cb.b - ca.b) * p);
  return `rgb(${r}, ${g}, ${bl})`;
}

export function deadlineProgress(startDate: string, dueDate: string | null) {
  if (!dueDate) return 0;
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const due = new Date(`${dueDate}T23:59:59`).getTime();
  const today = Date.now();

  if (due <= start) return today >= due ? 1 : 0;
  return clamp((today - start) / (due - start));
}

export function deadlineColor(progress: number) {
  const p = clamp(progress);

  const green = "#B9DE8A";
  const yellow = "#F2D36A";
  const orange = "#EFA45F";
  const red = "#E56D64";

  if (p <= 0.30) return mix(green, yellow, p / 0.30);
  if (p <= 0.50) return mix(yellow, orange, (p - 0.30) / 0.20);
  if (p <= 0.70) return mix(orange, red, (p - 0.50) / 0.20);
  return red;
}
