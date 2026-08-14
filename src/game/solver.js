// Generic constraint solver for a Spice Grid board layout (size + region
// map). Used both to verify a freshly generated puzzle has exactly one
// solution, and as a building block for future hint features.
//
// Framework-agnostic: pure functions over plain data, no React/DOM.

/**
 * Counts valid chilli placements for a board (one per row, one per column,
 * one per region, no two touching including diagonally), stopping early
 * once `limit` solutions have been found.
 *
 * Because a valid placement has exactly one chilli per row, two placed
 * chillies can only ever be adjacent if their rows differ by exactly 1 —
 * non-adjacent rows are always more than one row apart. That lets the
 * search check adjacency against only the immediately preceding row.
 *
 * @param {{size: number, regions: number[][]}} board
 * @param {number} [limit=2] - Stop counting once this many solutions are found.
 * @returns {number} Number of solutions found (capped at `limit`).
 */
export function countSolutions({ size, regions }, limit = 2) {
  const usedCols = new Array(size).fill(false);
  const usedRegions = new Array(size).fill(false);
  const placedCol = new Array(size).fill(-1);
  let found = 0;

  const backtrack = (row) => {
    if (found >= limit) return;
    if (row === size) {
      found++;
      return;
    }
    for (let col = 0; col < size; col++) {
      if (usedCols[col]) continue;
      const regionId = regions[row][col];
      if (usedRegions[regionId]) continue;
      if (row > 0) {
        const prevCol = placedCol[row - 1];
        if (Math.abs(prevCol - col) <= 1) continue;
      }

      usedCols[col] = true;
      usedRegions[regionId] = true;
      placedCol[row] = col;

      backtrack(row + 1);

      usedCols[col] = false;
      usedRegions[regionId] = false;
      placedCol[row] = -1;

      if (found >= limit) return;
    }
  };

  backtrack(0);
  return found;
}

/**
 * Finds a single valid solution for the given board, or null if none
 * exists. Handy for a future "show solution" / hint feature.
 *
 * @param {{size: number, regions: number[][]}} board
 * @returns {number[][]|null} Array of [row, col] pairs, or null.
 */
export function findSolution({ size, regions }) {
  const solutions = findSolutions({ size, regions }, 1);
  return solutions.length > 0 ? solutions[0] : null;
}

/**
 * Like `countSolutions`, but returns the actual placements instead of just
 * a count — used by the generator to grab two distinct solutions when a
 * layout isn't unique, so it can target a fix instead of discarding the
 * whole board and starting over.
 *
 * @param {{size: number, regions: number[][]}} board
 * @param {number} [limit=2]
 * @returns {number[][][]} Up to `limit` solutions, each an array of [row, col] pairs.
 */
export function findSolutions({ size, regions }, limit = 2) {
  const usedCols = new Array(size).fill(false);
  const usedRegions = new Array(size).fill(false);
  const placedCol = new Array(size).fill(-1);
  const solutions = [];

  const backtrack = (row) => {
    if (solutions.length >= limit) return;
    if (row === size) {
      solutions.push(placedCol.map((col, r) => [r, col]));
      return;
    }
    for (let col = 0; col < size; col++) {
      if (usedCols[col]) continue;
      const regionId = regions[row][col];
      if (usedRegions[regionId]) continue;
      if (row > 0 && Math.abs(placedCol[row - 1] - col) <= 1) continue;

      usedCols[col] = true;
      usedRegions[regionId] = true;
      placedCol[row] = col;

      backtrack(row + 1);

      usedCols[col] = false;
      usedRegions[regionId] = false;
      placedCol[row] = -1;

      if (solutions.length >= limit) return;
    }
  };

  backtrack(0);
  return solutions;
}
