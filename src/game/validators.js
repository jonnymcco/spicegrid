// Rule checks shared by the UI (for live error highlighting) and by the
// win-condition check. Framework-agnostic: operates on plain arrays.
//
// A "cell state" grid is a size x size array where each entry is one of:
//   "empty" | "x" | "chilli"
// ("x" is the player's own scratch mark and never participates in rules.)

export const CELL_EMPTY = "empty";
export const CELL_X = "x";
export const CELL_CHILLI = "chilli";

function key(r, c) {
  return `${r},${c}`;
}

function getChilliPositions(cellStates) {
  const positions = [];
  for (let r = 0; r < cellStates.length; r++) {
    for (let c = 0; c < cellStates[r].length; c++) {
      if (cellStates[r][c] === CELL_CHILLI) positions.push([r, c]);
    }
  }
  return positions;
}

/**
 * Finds every rule violation among currently-placed chillies:
 * two chillies touching (including diagonally), or two chillies sharing a
 * row, column, or region.
 *
 * @returns {Set<string>} "row,col" keys of every chilli involved in a
 *   violation, for red-flash highlighting.
 */
export function findConflicts(cellStates, regions) {
  const conflicts = new Set();
  const positions = getChilliPositions(cellStates);

  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const [r1, c1] = positions[i];
      const [r2, c2] = positions[j];

      const rowClash = r1 === r2;
      const colClash = c1 === c2;
      const regionClash = regions[r1][c1] === regions[r2][c2];
      const touching = Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1;

      if (rowClash || colClash || regionClash || touching) {
        conflicts.add(key(r1, c1));
        conflicts.add(key(r2, c2));
      }
    }
  }

  return conflicts;
}

/**
 * Returns the set of "row,col" keys sharing a row, column, or region with
 * the given cell (used to highlight a placed chilli's row/col/region for
 * self-checking). Does not include adjacency/touching cells.
 */
export function getHighlightedCells(row, col, regions) {
  const size = regions.length;
  const regionId = regions[row][col];
  const highlighted = new Set();

  for (let i = 0; i < size; i++) {
    highlighted.add(key(row, i));
    highlighted.add(key(i, col));
  }
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (regions[r][c] === regionId) highlighted.add(key(r, c));
    }
  }

  return highlighted;
}

/**
 * Checks whether the current board state is a complete, valid solution:
 * exactly N chillies placed, one per row/column/region, none touching.
 */
export function isSolved(cellStates, regions) {
  const size = cellStates.length;
  const positions = getChilliPositions(cellStates);
  if (positions.length !== size) return false;
  if (findConflicts(cellStates, regions).size > 0) return false;

  const rows = new Set(positions.map(([r]) => r));
  const cols = new Set(positions.map(([, c]) => c));
  const regionIds = new Set(positions.map(([r, c]) => regions[r][c]));

  return rows.size === size && cols.size === size && regionIds.size === size;
}

/** Creates a fresh size x size grid of CELL_EMPTY. */
export function createEmptyCellStates(size) {
  return Array.from({ length: size }, () => new Array(size).fill(CELL_EMPTY));
}
