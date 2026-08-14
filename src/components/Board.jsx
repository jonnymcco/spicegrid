import { useMemo, useRef } from "react";
import Cell from "./Cell.jsx";
import { getHighlightedCells } from "../game/validators.js";
import { CELL_SHAMROCK } from "../game/validators.js";

const REGION_BORDER = "#1B1023";
const GRID_LINE = "rgba(27, 16, 35, 0.12)";

function computeBorderStyle(regions, row, col, size) {
  const here = regions[row][col];
  const top = row === 0 || regions[row - 1][col] !== here;
  const left = col === 0 || regions[row][col - 1] !== here;
  const bottom = row === size - 1 || regions[row + 1][col] !== here;
  const right = col === size - 1 || regions[row][col + 1] !== here;

  const side = (isRegionEdge) => `${isRegionEdge ? 2.5 : 0.5}px solid ${isRegionEdge ? REGION_BORDER : GRID_LINE}`;

  return {
    borderTop: side(top),
    borderLeft: side(left),
    borderBottom: side(bottom),
    borderRight: side(right),
  };
}

/** Reads the [row, col] of whichever cell button is under a client point, or null. */
function cellAtPoint(clientX, clientY) {
  const el = document.elementFromPoint(clientX, clientY);
  const cellEl = el?.closest?.("[data-row]");
  if (!cellEl) return null;
  return [Number(cellEl.dataset.row), Number(cellEl.dataset.col)];
}

const EMPTY_SET = new Set();

export default function Board({
  puzzle,
  cellStates,
  conflicts,
  regionColors,
  regionNames,
  hintedCells = EMPTY_SET,
  onCellClick,
  onDragMarkCell,
}) {
  const { size, regions } = puzzle;
  const boardRef = useRef(null);
  // Tracks an in-progress press-and-drag gesture (see handlePointerDown).
  // Kept in a ref, not state, since it changes every pointermove and
  // shouldn't itself trigger a re-render.
  const dragRef = useRef({ pointerId: null, startCell: null, lastCell: null, isDragging: false });
  // Separate from dragRef because it needs to survive past pointerup: the
  // click event that may follow fires *after* pointerup's handler already
  // resets dragRef, so a flag living only on dragRef would already read
  // false by the time handleCellClick needs to check it. This one is only
  // cleared by the next pointerdown or by handleCellClick consuming it.
  const draggedThisGestureRef = useRef(false);

  const highlighted = useMemo(() => {
    const union = new Set();
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (cellStates[r][c] === CELL_SHAMROCK) {
          for (const k of getHighlightedCells(r, c, regions)) union.add(k);
        }
      }
    }
    return union;
  }, [cellStates, regions, size]);

  // A stationary tap still falls through to each Cell's own onClick (which
  // cycles empty -> X -> shamrock -> empty) — untouched by any of this.
  // Once the pointer moves into a *different* cell before lifting, that
  // becomes a drag: every new cell the gesture passes over gets marked X
  // (shamrocks are left alone, and already-X cells are a no-op), the same
  // way a highlighter stroke works. Dragging back onto the start cell and
  // releasing there would otherwise also fire a native click on it (click
  // only cares whether pointerdown/pointerup targeted the same element,
  // not what happened in between) — handleCellClick guards against that
  // double action.
  const handlePointerDown = (row, col, event) => {
    // Deliberately does NOT call setPointerCapture here — capturing
    // unconditionally on every press turns out to suppress the browser's
    // native click event even for a plain, no-movement tap (verified in
    // Chromium), which would silently break the ordinary cycle-on-tap
    // behaviour for every click, not just drags. Capture is only taken
    // once a real drag is confirmed, in handlePointerMove below.
    dragRef.current = { pointerId: event.pointerId, startCell: [row, col], lastCell: null, isDragging: false };
    draggedThisGestureRef.current = false;
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId || !drag.startCell) return;

    const cell = cellAtPoint(event.clientX, event.clientY);
    if (!cell) return;
    const [row, col] = cell;
    const [startRow, startCol] = drag.startCell;

    if (!drag.isDragging) {
      if (row === startRow && col === startCol) return; // hasn't left the starting cell yet
      drag.isDragging = true;
      draggedThisGestureRef.current = true;
      // Now that this is confirmed to be a drag (not a tap), capture the
      // pointer so tracking survives the finger sliding outside the
      // board's bounds for the rest of this gesture.
      boardRef.current?.setPointerCapture?.(event.pointerId);
      onDragMarkCell(startRow, startCol);
      drag.lastCell = drag.startCell;
    }

    const [lastRow, lastCol] = drag.lastCell;
    if (row === lastRow && col === lastCol) return;
    onDragMarkCell(row, col);
    drag.lastCell = [row, col];
  };

  const endDrag = (event) => {
    if (dragRef.current.pointerId === event.pointerId) {
      dragRef.current = { pointerId: null, startCell: null, lastCell: null, isDragging: false };
    }
  };

  const handleCellClick = (row, col) => {
    // A real drag already marked every cell it touched, including the
    // start cell — swallow the trailing click so it doesn't also cycle
    // that cell an extra step.
    if (draggedThisGestureRef.current) {
      draggedThisGestureRef.current = false;
      return;
    }
    onCellClick(row, col);
  };

  return (
    <div
      ref={boardRef}
      className="mx-auto grid w-full max-w-[min(92vw,34rem)] touch-none select-none overflow-hidden rounded-xl border-[3px] border-riso-ink shadow-riso bg-riso-ink"
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
      role="grid"
      aria-label="Lucky Patch puzzle board"
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {regions.map((rowRegions, row) =>
        rowRegions.map((regionId, col) => {
          const key = `${row},${col}`;
          return (
            <Cell
              key={key}
              row={row}
              col={col}
              state={cellStates[row][col]}
              regionColor={regionColors[regionId]?.hex}
              regionIconColor={regionColors[regionId]?.iconColor}
              regionName={regionNames[regionId]}
              isHighlighted={highlighted.has(key)}
              isConflict={conflicts.has(key)}
              isHinted={hintedCells.has(key)}
              borderStyle={computeBorderStyle(regions, row, col, size)}
              onClick={() => handleCellClick(row, col)}
              onPointerDown={(event) => handlePointerDown(row, col, event)}
            />
          );
        })
      )}
    </div>
  );
}
