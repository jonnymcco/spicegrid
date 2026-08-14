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

/**
 * Same search as `countSolutions`, but lets the caller pin some rows to a
 * specific column (`forcedCol[row]`, or -1 for "not yet forced") and rule
 * out specific cells entirely (`excluded`, a Set of "row,col" strings).
 * This is the building block `solveByPropagation` uses to test whether a
 * given cell's status is *logically forced* — if assuming the opposite
 * makes this come back 0, there was only ever one possibility.
 *
 * @param {{size: number, regions: number[][]}} board
 * @param {number[]} forcedCol - length `size`; forcedCol[row] is a pinned
 *   column, or -1 if that row isn't pinned yet.
 * @param {Set<string>} excluded - "row,col" keys that may never hold the chilli.
 * @param {number} [limit=1]
 * @returns {number} Number of consistent solutions found (capped at `limit`).
 */
export function countConstrainedSolutions({ size, regions }, forcedCol, excluded, limit = 1) {
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

    const pinned = forcedCol[row];
    const candidateCols = pinned !== -1 && pinned !== undefined ? [pinned] : null;

    for (let i = 0; i < size; i++) {
      const col = candidateCols ? candidateCols[i] : i;
      if (col === undefined) continue;
      if (usedCols[col]) continue;
      if (excluded.has(`${row},${col}`)) continue;
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

      if (found >= limit) return;
      if (candidateCols) break;
    }
  };

  backtrack(0);
  return found;
}

/**
 * Solves a board using only *logically forced* moves — the same standard
 * a careful player applies when they say "this cell has to be X, because
 * assuming otherwise leaves no valid way to finish the puzzle." At each
 * pass, every still-undetermined cell is tested by temporarily assuming
 * the opposite of each possibility; if that assumption leaves zero
 * consistent completions, the cell's true status was forced, and gets
 * locked in. Repeats until nothing new is forced.
 *
 * This is a much stronger (and honest) standard than pattern-matching a
 * handful of named human techniques: if this returns fully resolved, the
 * puzzle is provably solvable step-by-step without ever guessing a branch
 * and hoping it works out — which is exactly what "no guessing required"
 * means. If it returns not-fully-resolved, at least one point in the
 * puzzle has no single forced next move under pure deduction (multiple
 * genuinely-still-possible completions), i.e. it would require guessing.
 *
 * @param {{size: number, regions: number[][]}} board
 * @returns {{
 *   solved: boolean,             // true iff every row got a forced column
 *   forcedCol: number[],         // forcedCol[row] = column, or -1 if still undetermined
 *   excluded: Set<string>,       // "row,col" cells proven impossible along the way
 * }}
 */
export function solveByPropagation({ size, regions }) {
  const forcedCol = new Array(size).fill(-1);
  const excluded = new Set();

  const applyDirectEliminations = (row, col) => {
    const regionId = regions[row][col];
    for (let c = 0; c < size; c++) if (c !== col) excluded.add(`${row},${c}`);
    for (let r = 0; r < size; r++) {
      if (r === row) continue;
      excluded.add(`${r},${col}`);
      for (let c = 0; c < size; c++) {
        if (regions[r][c] === regionId) excluded.add(`${r},${c}`);
      }
      if (Math.abs(r - row) <= 1) {
        for (const dc of [-1, 0, 1]) excluded.add(`${r},${col + dc}`);
      }
    }
  };

  let progress = true;
  while (progress) {
    progress = false;

    for (let row = 0; row < size; row++) {
      if (forcedCol[row] !== -1) continue;

      for (let col = 0; col < size; col++) {
        if (excluded.has(`${row},${col}`)) continue;

        // Assume this cell is NOT the chilli for its row — if that leaves
        // no valid completion at all, it must actually be the chilli.
        const excludedPlusThis = new Set(excluded);
        excludedPlusThis.add(`${row},${col}`);
        const countWithoutIt = countConstrainedSolutions({ size, regions }, forcedCol, excludedPlusThis, 1);

        if (countWithoutIt === 0) {
          forcedCol[row] = col;
          applyDirectEliminations(row, col);
          progress = true;
          break;
        }

        // Assume this cell IS the chilli — if that leaves no valid
        // completion, it must actually be impossible.
        const forcedPlusThis = forcedCol.slice();
        forcedPlusThis[row] = col;
        const countWithIt = countConstrainedSolutions({ size, regions }, forcedPlusThis, excluded, 1);

        if (countWithIt === 0) {
          excluded.add(`${row},${col}`);
          progress = true;
        }
      }

      if (progress) break; // re-scan from row 0 with the freshly tightened constraints
    }
  }

  const solved = forcedCol.every((c) => c !== -1);
  return { solved, forcedCol, excluded };
}
