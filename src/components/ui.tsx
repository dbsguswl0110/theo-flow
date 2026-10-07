import type { ReactNode } from "react";
import TheoArt, { type TheoKind } from "./TheoArt";
import TeoSprite from "./TeoSprite";
import { FRAME } from "../lib/teoSprites";

export type Tone = TheoKind | "trash" | "settings";

/** TEO's sticker for a screen: the matching icon from the artwork on a soft coloured disc. */
export function TypeSticker({ tone }: { tone: Tone }) {
  return (
    <span className={`tc-sticker tone-${tone}`} aria-hidden="true">
      {tone === "trash" || tone === "settings" ? (
        <TeoSprite cell={tone === "trash" ? FRAME.napping : FRAME.sit} size={64} />
      ) : (
        <TheoArt kind={tone} />
      )}
    </span>
  );
}

/** Header shared by every inner screen: back button, sticker, title with a friendly line, actions. */
export function ScreenHeader({
  title,
  subtitle,
  tone,
  backLabel,
  onBack,
  count,
  actions,
  disabled,
}: {
  title: string;
  subtitle?: string;
  tone: Tone;
  backLabel: string;
  /** Left out where the screen is a tab of its own (the Mac app), so there is nothing to go back to. */
  onBack?: () => void;
  count?: number;
  actions?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <header className={`tc-header tone-${tone}`}>
      {onBack && (
        <button type="button" className="tc-back" aria-label={backLabel} disabled={disabled} onClick={onBack}>
          ←
        </button>
      )}
      <TypeSticker tone={tone} />
      <div className="tc-title">
        <h1>
          {title}
          {count !== undefined && <span className="tc-count">{count}</span>}
        </h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="tc-actions">{actions}</div>}
    </header>
  );
}

/** TEO napping, with a nudge toward the first action. */
export function EmptyState({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="tc-empty">
      <TeoSprite cell={FRAME.napping} size={112} />
      <strong>{title}</strong>
      {hint && <p>{hint}</p>}
      {children}
    </div>
  );
}

/** A labelled on/off switch built on a real checkbox, so it stays keyboard and screen-reader friendly. */
export function Switch({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="tc-switch">
      <span className="tc-switch-text">
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <i aria-hidden="true" />
    </label>
  );
}

const icon = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
export const CheckIcon = () => (
  <svg {...icon}>
    <path d="M5 12.5l4.2 4.2L19 7" />
  </svg>
);
export const TrashIcon = () => (
  <svg {...icon}>
    <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" />
  </svg>
);
export const UndoIcon = () => (
  <svg {...icon}>
    <path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.7L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);
export const PlusIcon = () => (
  <svg {...icon}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
