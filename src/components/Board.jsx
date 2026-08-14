import { useMemo } from "react";
import Cell from "./Cell.jsx";
import { getHighlightedCells } from "../game/validators.js";
import { CELL_CHILLI } from "../game/validators.js";

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

const EMPTY_SET = new Set();

export default function Board({
  puzzle,
  cellStates,
  conflicts,
  regionColors,
  regionNames,
  hintedCells = EMPTY_SET,
  onCellClick,
}) {
  const { size, regions } = puzzle;

  const highlighted = useMemo(() => {
    const union = new Set();
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (cellStates[r][c] === CELL_CHILLI) {
          for (const k of getHighlightedCells(r, c, regions)) union.add(k);
        }
      }
    }
    return union;
  }, [cellStates, regions, size]);

  return (
    <div
      className="mx-auto grid w-full max-w-[min(92vw,34rem)] overflow-hidden rounded-xl border-[3px] border-riso-ink shadow-riso bg-riso-ink"
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
      role="grid"
      aria-label="Spice Grid puzzle board"
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
              onClick={() => onCellClick(row, col)}
            />
          );
        })
      )}
    </div>
  );
}
