// A hint engine that reasons about the board the way a player would,
// rather than just handing over the answer. Framework-agnostic (plain
// data in, plain data out) so it's testable and reusable outside React.
//
// `getHint` runs a handful of real deduction rules, in order from easiest
// to spot to hardest, and returns the first one that applies:
//
//   1. conflict     — a placed chilli rules out other cells in its row,
//                      column, region, or touching it, that aren't
//                      marked yet.
//   2. locked        — a region's remaining candidates all sit in one row
//                      (or column), which means that row's chilli has to
//                      come from this region — ruling out every other
//                      cell in that row.
//   3. naked-single  — a row, column, or region has exactly one
//                      candidate cell left, so it must hold the chilli.
//   4. forced        — none of the named patterns above apply (uncommon —
//                      mostly early on, before enough is marked for a
//                      pattern to stand out); falls through to
//                      `solver.js`'s constraint propagation, which tests
//                      each remaining possibility by assuming its opposite
//                      and checking whether that leaves any valid way to
//                      finish the puzzle at all. If assuming a cell is
//                      empty breaks solvability, it has to hold the
//                      chilli; if assuming it holds the chilli breaks
//                      solvability, it can be ruled out. This is strictly
//                      *stronger* than the named rules — genuinely never a
//                      guess, just deeper reasoning than fits a one-line
//                      pattern name — and every generated puzzle is
//                      verified solvable this way before it's ever shown
//                      to a player (see `generateGrid.js`), so this tier
//                      is guaranteed to find something whenever the named
//                      rules don't.
//
// Each rule is checked against the *true* remaining candidate set, which
// factors in eliminations implied by placed chillies even if the player
// hasn't manually marked them with an X yet — otherwise a player who
// skips marking obvious eliminations would get worse hints, not better
// ones.

import { CELL_CHILLI, CELL_EMPTY, CELL_X } from "./validators.js";
import { countConstrainedSolutions } from "./solver.js";

const ORTHOGONAL_NEIGHBORS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
const ALL_NEIGHBORS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

function inBounds(size, r, c) {
  return r >= 0 && r < size && c >= 0 && c < size;
}

function key(r, c) {
  return `${r},${c}`;
}

/**
 * True remaining candidates: not marked X, not itself a placed chilli, and
 * not ruled out by sharing a row/column/region with — or touching — a
 * chilli that's already on the board (whether or not the player has
 * marked those cells).
 */
export function computeCandidates(cellStates, regions, size) {
  const candidate = Array.from({ length: size }, () => new Array(size).fill(true));
  const placedChillies = [];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (cellStates[r][c] === CELL_X) candidate[r][c] = false;
      if (cellStates[r][c] === CELL_CHILLI) {
        candidate[r][c] = false;
        placedChillies.push([r, c]);
      }
    }
  }

  for (const [pr, pc] of placedChillies) {
    const regionId = regions[pr][pc];
    for (let i = 0; i < size; i++) {
      candidate[pr][i] = false;
      candidate[i][pc] = false;
    }
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (regions[r][c] === regionId) candidate[r][c] = false;
      }
    }
    for (const [dr, dc] of ALL_NEIGHBORS) {
      const nr = pr + dr;
      const nc = pc + dc;
      if (inBounds(size, nr, nc)) candidate[nr][nc] = false;
    }
  }

  return candidate;
}

function rowHasChilli(cellStates, row, size) {
  for (let c = 0; c < size; c++) if (cellStates[row][c] === CELL_CHILLI) return true;
  return false;
}
function colHasChilli(cellStates, col, size) {
  for (let r = 0; r < size; r++) if (cellStates[r][col] === CELL_CHILLI) return true;
  return false;
}
function regionHasChilli(cellStates, regions, regionId, size) {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (regions[r][c] === regionId && cellStates[r][c] === CELL_CHILLI) return true;
    }
  }
  return false;
}

/** Rule 1: cells an existing chilli already rules out, but that aren't marked X yet. */
function findConflictHint(cellStates, regions, size) {
  for (let pr = 0; pr < size; pr++) {
    for (let pc = 0; pc < size; pc++) {
      if (cellStates[pr][pc] !== CELL_CHILLI) continue;
      const regionId = regions[pr][pc];
      const cells = [];
      const seen = new Set();

      const add = (r, c) => {
        if (!inBounds(size, r, c)) return;
        if (r === pr && c === pc) return;
        if (cellStates[r][c] !== CELL_EMPTY) return;
        const k = key(r, c);
        if (seen.has(k)) return;
        seen.add(k);
        cells.push([r, c]);
      };

      for (let i = 0; i < size; i++) {
        add(pr, i);
        add(i, pc);
      }
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (regions[r][c] === regionId) add(r, c);
        }
      }
      for (const [dr, dc] of ALL_NEIGHBORS) add(pr + dr, pc + dc);

      if (cells.length > 0) {
        return { type: "eliminate", reason: "conflict", cells, sourceCell: [pr, pc] };
      }
    }
  }
  return null;
}

/** Rule 2: a region's remaining candidates are all in one row/column. */
function findLockedCandidateHint(cellStates, regions, size, candidates) {
  for (let regionId = 0; regionId < size; regionId++) {
    if (regionHasChilli(cellStates, regions, regionId, size)) continue;

    const regionCandidates = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (regions[r][c] === regionId && candidates[r][c]) regionCandidates.push([r, c]);
      }
    }
    if (regionCandidates.length === 0) continue;

    const rows = new Set(regionCandidates.map(([r]) => r));
    if (rows.size === 1) {
      const [row] = rows;
      const cells = [];
      for (let c = 0; c < size; c++) {
        if (regions[row][c] !== regionId && candidates[row][c]) cells.push([row, c]);
      }
      if (cells.length > 0) {
        return { type: "eliminate", reason: "locked-row", cells, regionId, row };
      }
    }

    const cols = new Set(regionCandidates.map(([, c]) => c));
    if (cols.size === 1) {
      const [col] = cols;
      const cells = [];
      for (let r = 0; r < size; r++) {
        if (regions[r][col] !== regionId && candidates[r][col]) cells.push([r, col]);
      }
      if (cells.length > 0) {
        return { type: "eliminate", reason: "locked-column", cells, regionId, col };
      }
    }
  }
  return null;
}

/** Rule 3: a region, row, or column has exactly one candidate cell left. */
function findNakedSingleHint(cellStates, regions, size, candidates) {
  for (let regionId = 0; regionId < size; regionId++) {
    if (regionHasChilli(cellStates, regions, regionId, size)) continue;
    const cells = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (regions[r][c] === regionId && candidates[r][c]) cells.push([r, c]);
      }
    }
    if (cells.length === 1) {
      return { type: "place", reason: "naked-single-region", cells, regionId };
    }
  }

  for (let row = 0; row < size; row++) {
    if (rowHasChilli(cellStates, row, size)) continue;
    const cells = [];
    for (let c = 0; c < size; c++) if (candidates[row][c]) cells.push([row, c]);
    if (cells.length === 1) {
      return { type: "place", reason: "naked-single-row", cells, row };
    }
  }

  for (let col = 0; col < size; col++) {
    if (colHasChilli(cellStates, col, size)) continue;
    const cells = [];
    for (let r = 0; r < size; r++) if (candidates[r][col]) cells.push([r, col]);
    if (cells.length === 1) {
      return { type: "place", reason: "naked-single-column", cells, col };
    }
  }

  return null;
}

/** The current board state, expressed as constraints for `countConstrainedSolutions`. */
function buildConstraints(cellStates, size) {
  const forcedCol = new Array(size).fill(-1);
  const excluded = new Set();

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (cellStates[r][c] === CELL_CHILLI) forcedCol[r] = c;
      if (cellStates[r][c] === CELL_X) excluded.add(key(r, c));
    }
  }

  return { forcedCol, excluded };
}

/**
 * Rule 4: no named pattern applies — fall through to constraint
 * propagation and find one cell whose status is *provably forced* from
 * here, by testing whether assuming the opposite breaks solvability.
 * Doesn't need or consult the precomputed solution at all — it derives
 * the answer honestly from the current board state, the same way
 * `generateGrid.js` verifies every puzzle is solvable this way before
 * it's shown to a player.
 */
function findForcedHint(cellStates, regions, size) {
  const { forcedCol, excluded } = buildConstraints(cellStates, size);

  for (let row = 0; row < size; row++) {
    if (forcedCol[row] !== -1) continue;

    for (let col = 0; col < size; col++) {
      if (excluded.has(key(row, col))) continue;

      const assumeEmpty = new Set(excluded);
      assumeEmpty.add(key(row, col));
      const waysIfEmpty = countConstrainedSolutions({ size, regions }, forcedCol, assumeEmpty, 1);
      if (waysIfEmpty === 0) {
        return { type: "place", reason: "forced", cells: [[row, col]] };
      }

      const assumeChilli = forcedCol.slice();
      assumeChilli[row] = col;
      const waysIfChilli = countConstrainedSolutions({ size, regions }, assumeChilli, excluded, 1);
      if (waysIfChilli === 0) {
        return { type: "eliminate", reason: "forced", cells: [[row, col]] };
      }
    }
  }

  return null;
}

/**
 * Finds the next best hint for the current board state, or null if the
 * puzzle is already solved.
 *
 * @param {string[][]} cellStates
 * @param {number[][]} regions
 * @param {number} size
 */
export function getHint(cellStates, regions, size) {
  const candidates = computeCandidates(cellStates, regions, size);

  return (
    findConflictHint(cellStates, regions, size) ||
    findLockedCandidateHint(cellStates, regions, size, candidates) ||
    findNakedSingleHint(cellStates, regions, size, candidates) ||
    findForcedHint(cellStates, regions, size)
  );
}

const ORDINAL = (n) => `${n + 1}`;

/**
 * Turns a hint returned by `getHint` into a plain-English explanation.
 * `regionNames` is a plain array (regionId -> name), passed in so this
 * module never has to import the presentation-layer colour palette.
 */
export function describeHint(hint, regionNames) {
  if (!hint) return "No hint available — looks like everything's already deducible from here!";

  const regionName = (id) => regionNames?.[id] ?? `region ${id + 1}`;

  switch (hint.reason) {
    case "conflict": {
      const [r, c] = hint.sourceCell;
      const plural = hint.cells.length > 1 ? "cells" : "cell";
      return `The chilli at row ${ORDINAL(r)}, column ${ORDINAL(c)} rules out ${hint.cells.length} more ${plural} — each one shares its row, column, or region with that chilli, or would touch it. Mark them with an ✕.`;
    }
    case "locked-row":
      return `Every remaining candidate cell in ${regionName(hint.regionId)} is in row ${ORDINAL(
        hint.row
      )}. That means row ${ORDINAL(hint.row)}'s chilli has to come from ${regionName(
        hint.regionId
      )} — so every other cell in that row can be ruled out.`;
    case "locked-column":
      return `Every remaining candidate cell in ${regionName(hint.regionId)} is in column ${ORDINAL(
        hint.col
      )}. That means column ${ORDINAL(hint.col)}'s chilli has to come from ${regionName(
        hint.regionId
      )} — so every other cell in that column can be ruled out.`;
    case "naked-single-region":
      return `${regionName(hint.regionId)} has only one cell left that isn't ruled out — its chilli has to go there.`;
    case "naked-single-row":
      return `Row ${ORDINAL(hint.row)} has only one cell left that isn't ruled out — its chilli has to go there.`;
    case "naked-single-column":
      return `Column ${ORDINAL(hint.col)} has only one cell left that isn't ruled out — its chilli has to go there.`;
    case "forced": {
      const [r, c] = hint.cells[0];
      if (hint.type === "place") {
        return `This one takes deeper reasoning: try assuming row ${ORDINAL(r)}'s chilli is anywhere except column ${ORDINAL(
          c
        )} — every one of those leaves no valid way to finish the rest of the board. So it has to go there.`;
      }
      return `This one takes deeper reasoning: assuming a chilli at row ${ORDINAL(r)}, column ${ORDINAL(
        c
      )} leaves no valid way to finish the rest of the board — so it can be ruled out.`;
    }
    default:
      return "Here's a cell to look at.";
  }
}
