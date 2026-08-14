import ChilliIcon from "./ChilliIcon.jsx";
import { CELL_CHILLI, CELL_X } from "../game/validators.js";

export default function Cell({
  row,
  col,
  state,
  regionColor,
  regionName,
  isHighlighted,
  isConflict,
  borderStyle,
  onClick,
}) {
  const label =
    state === CELL_CHILLI
      ? `Row ${row + 1}, column ${col + 1}, ${regionName} region, chilli placed`
      : state === CELL_X
      ? `Row ${row + 1}, column ${col + 1}, ${regionName} region, marked with X`
      : `Row ${row + 1}, column ${col + 1}, ${regionName} region, empty`;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        backgroundColor: regionColor,
        ...borderStyle,
      }}
      className={[
        "relative flex aspect-square w-full items-center justify-center",
        "transition-transform duration-150 ease-out",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-riso-pink focus-visible:ring-offset-1",
        "active:scale-95",
        isConflict ? "animate-shake" : "",
      ].join(" ")}
    >
      {isHighlighted && <span className="pointer-events-none absolute inset-0 bg-white/25 dark:bg-white/10" />}
      {isConflict && <span className="pointer-events-none absolute inset-0 animate-flash-error" />}

      {state === CELL_X && (
        <span className="pointer-events-none select-none text-[clamp(1rem,4vw,1.6rem)] font-display font-bold text-black/35 dark:text-white/50">
          &times;
        </span>
      )}

      {state === CELL_CHILLI && (
        <ChilliIcon
          className={[
            "h-[62%] w-[62%] drop-shadow-[1px_2px_0_rgba(0,0,0,0.25)]",
            "animate-pop",
            isConflict ? "text-riso-ink" : "text-white",
          ].join(" ")}
        />
      )}
    </button>
  );
}
