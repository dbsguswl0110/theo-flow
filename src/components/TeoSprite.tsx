import { TEO_CELL, TEO_COLS, TEO_ROWS } from "../lib/teoSprites.generated";

const SHEET = "/assets/teo-sprites.webp";

// Start fetching the sheet as soon as the module loads so TEO never pops in half-drawn.
if (typeof Image !== "undefined") new Image().src = SHEET;

/** One frame of TEO from the transparent sprite sheet. */
export default function TeoSprite({
  cell,
  size = 96,
  className = "",
}: {
  cell: number;
  size?: number;
  className?: string;
}) {
  const col = cell % TEO_COLS;
  const row = Math.floor(cell / TEO_COLS);
  const unit = size / TEO_CELL;
  return (
    <span
      className={`teo-sprite ${className}`}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${SHEET})`,
        backgroundSize: `${TEO_COLS * TEO_CELL * unit}px ${TEO_ROWS * TEO_CELL * unit}px`,
        backgroundPosition: `${-col * size}px ${-row * size}px`,
      }}
    />
  );
}
