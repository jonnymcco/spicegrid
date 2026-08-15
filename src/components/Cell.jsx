import ShamrockIcon from "./ShamrockIcon.jsx";
import { CELL_SHAMROCK, CELL_X } from "../game/validators.js";

export default function Cell({
  row,
  col,
  state,
  regionColor,
  regionIconColor,
  regionName,
  isHighlighted,
  isConflict,
  isHinted,
  isBlamed,
  borderStyle,
  onClick,
  onPointerDown,
}) {
  const label =
    state === CELL_SHAMROCK
      ? `Row ${row + 1}, column ${col + 1}, ${regionName} region, shamrock placed`
      : state === CELL_X
      ? `Row ${row + 1}, column ${col + 1}, ${regionName} region, marked with X`
      : `Row ${row + 1}, column ${col + 1}, ${regionName} region, empty`;

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      data-row={row}
      data-col={col}
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
      {isHinted && (
        <span className="pointer-events-none absolute inset-0 animate-pulse ring-[3px] ring-inset ring-amber-400" />
      )}
      {/* Deliberately a different colour from the amber "do this" hint ring:
          this one means "this move of yours is the problem". */}
      {isBlamed && (
        <span className="pointer-events-none absolute inset-0 animate-pulse ring-[3px] ring-inset ring-rose-500" />
      )}

      {state === CELL_X && (
        <span
          className="pointer-events-none select-none text-[clamp(1rem,4vw,1.6rem)] font-display font-bold opacity-45"
          style={{ color: regionIconColor }}
        >
          &times;
        </span>
      )}

      {state === CELL_SHAMROCK && (
        <ShamrockIcon
          className={["h-[62%] w-[62%] drop-shadow-[1px_2px_0_rgba(0,0,0,0.25)]", "animate-pop"].join(" ")}
          style={{ color: isConflict ? "#1B1023" : regionIconColor }}
        />
      )}
    </button>
  );
}
