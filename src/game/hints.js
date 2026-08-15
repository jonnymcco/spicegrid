// A hint engine that reasons about the board the way a player would,
// rather than just handing over the answer. Framework-agnostic (plain
// data in, plain data out) so it's testable and reusable outside React.
//
// `getHint` runs a handful of real deduction rules, in order from easiest
// to spot to hardest, and returns the first one that applies:
//
//   1. conflict        — a placed shamrock rules out other cells in its row,
//                         column, region, or touching it, that aren't
//                         marked yet.
//   2. region-locked    — a region's remaining candidates all sit in one
//                         row (or column), which means that row's shamrock
//                         has to come from this region — ruling out every
//                         other cell in that row.
//   3. axis-locked      — the mirror image of #2: a row's (or column's)
//                         remaining candidates all sit in one region, so
//                         that region's shamrock has to come from this row —
//                         ruling out every other cell in that region.
//   4. naked-single     — a row, column, or region has exactly one
//                         candidate cell left, so it must hold the shamrock.
//   5. subset-locked     — a generalisation of #2: two or three regions
//                         (unresolved, considered together) have all their
//                         remaining candidates confined to exactly that
//                         many rows (or columns) between them. Since each
//                         needs a different row and there are exactly
//                         enough rows to go around, no *other* region can
//                         use any of those rows either. Same idea as
//                         "these two must fight over these two spots", one
//                         level up from #2.
//   6. forced            — every named pattern above failed to make
//                         progress (should be rare to the point of
//                         essentially never — see below); falls through to
//                         `solver.js`'s constraint propagation as a last
//                         resort.
//
// Rules 1-5 are all "obvious" in the sense that a player can verify them
// by looking at a small, fixed set of cells and counting — no hypothetical
// what-if reasoning about the rest of the board required. Rule 6 requires
// exactly that kind of reasoning ("assume the opposite, check whether the
// *entire* rest of the board still has a valid completion"), which isn't
// something a player can eyeball, so `generateGrid.js` treats "solvable
// using only rules 1-5" as a hard requirement for every generated puzzle
// (see `solveByNamedRules` below) — rule 6 exists purely as defensive
// code for the case that requirement is ever violated, not as an expected
// part of normal play.
//
// Each rule is checked against the *true* remaining candidate set, which
// factors in eliminations implied by placed shamrocks even if the player
// hasn't manually marked them with an X yet — otherwise a player who
// skips marking obvious eliminations would get worse hints, not better
// ones.

import { CELL_SHAMROCK, CELL_EMPTY, CELL_X } from "./validators.js";
import { countConstrainedSolutions, findConstrainedSolutions } from "./solver.js";

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

// How many regions (or rows/columns) the subset-lock rule will consider
// together. 3 is already a stretch for a "glance at it" hint, so this is
// deliberately capped rather than pushed higher for more raw solving power.
const MAX_SUBSET_SIZE = 3;

function inBounds(size, r, c) {
  return r >= 0 && r < size && c >= 0 && c < size;
}

function key(r, c) {
  return `${r},${c}`;
}

function combinations(items, k) {
  const results = [];
  const combo = [];
  const backtrack = (start) => {
    if (combo.length === k) {
      results.push(combo.slice());
      return;
    }
    for (let i = start; i < items.length; i++) {
      combo.push(items[i]);
      backtrack(i + 1);
      combo.pop();
    }
  };
  backtrack(0);
  return results;
}

/**
 * True remaining candidates: not marked X, not itself a placed shamrock, and
 * not ruled out by sharing a row/column/region with — or touching — a
 * shamrock that's already on the board (whether or not the player has
 * marked those cells).
 */
export function computeCandidates(cellStates, regions, size) {
  const candidate = Array.from({ length: size }, () => new Array(size).fill(true));
  const placedShamrocks = [];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (cellStates[r][c] === CELL_X) candidate[r][c] = false;
      if (cellStates[r][c] === CELL_SHAMROCK) {
        candidate[r][c] = false;
        placedShamrocks.push([r, c]);
      }
    }
  }

  for (const [pr, pc] of placedShamrocks) {
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

function rowHasShamrock(cellStates, row, size) {
  for (let c = 0; c < size; c++) if (cellStates[row][c] === CELL_SHAMROCK) return true;
  return false;
}
function colHasShamrock(cellStates, col, size) {
  for (let r = 0; r < size; r++) if (cellStates[r][col] === CELL_SHAMROCK) return true;
  return false;
}
function regionHasShamrock(cellStates, regions, regionId, size) {
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (regions[r][c] === regionId && cellStates[r][c] === CELL_SHAMROCK) return true;
    }
  }
  return false;
}

/** Rule 1: cells an existing shamrock already rules out, but that aren't marked X yet. */
function findConflictHint(cellStates, regions, size) {
  for (let pr = 0; pr < size; pr++) {
    for (let pc = 0; pc < size; pc++) {
      if (cellStates[pr][pc] !== CELL_SHAMROCK) continue;
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

/**
 * Rules 2 & 5 combined: `k` unresolved regions (k=1..MAX_SUBSET_SIZE),
 * considered together, have all their remaining candidates confined to
 * exactly `k` rows (or columns) between them. Since each of those regions
 * still needs its own row, and there are exactly enough rows to go around,
 * no *other* region can use any of those rows either. k=1 is the simple
 * "this one region is stuck in one row" case (named `locked-row`/
 * `locked-column`); k>=2 is the generalisation to a small group of regions
 * sharing a small group of rows (named `subset-row`/`subset-column`).
 */
function findRegionSubsetHint(cellStates, regions, size, candidates, axis) {
  const unresolvedRegions = [];
  for (let regionId = 0; regionId < size; regionId++) {
    if (!regionHasShamrock(cellStates, regions, regionId, size)) unresolvedRegions.push(regionId);
  }

  const axisCandidatesByRegion = new Map();
  for (const regionId of unresolvedRegions) {
    const set = new Set();
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (regions[r][c] === regionId && candidates[r][c]) set.add(axis === "row" ? r : c);
      }
    }
    axisCandidatesByRegion.set(regionId, set);
  }

  for (let k = 1; k <= Math.min(MAX_SUBSET_SIZE, unresolvedRegions.length); k++) {
    for (const subset of combinations(unresolvedRegions, k)) {
      const axisUnion = new Set();
      let anyEmpty = false;
      for (const regionId of subset) {
        const axisSet = axisCandidatesByRegion.get(regionId);
        if (axisSet.size === 0) {
          anyEmpty = true;
          break;
        }
        for (const value of axisSet) axisUnion.add(value);
      }
      if (anyEmpty || axisUnion.size !== k) continue;

      const cells = [];
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const onAxis = axisUnion.has(axis === "row" ? r : c);
          if (!onAxis || !candidates[r][c]) continue;
          if (!subset.includes(regions[r][c])) cells.push([r, c]);
        }
      }
      if (cells.length === 0) continue;

      if (k === 1) {
        return {
          type: "eliminate",
          reason: axis === "row" ? "locked-row" : "locked-column",
          cells,
          regionId: subset[0],
          [axis === "row" ? "row" : "col"]: [...axisUnion][0],
        };
      }
      return {
        type: "eliminate",
        reason: axis === "row" ? "subset-row" : "subset-column",
        cells,
        regionIds: subset,
        [axis === "row" ? "rows" : "cols"]: [...axisUnion].sort((a, b) => a - b),
      };
    }
  }
  return null;
}

/**
 * Rule 3 (the mirror image of rule 2): a row's (or column's) remaining
 * candidates are all inside one region, so that region's shamrock has to be
 * in this row — ruling out every other cell in the region.
 */
function findAxisLockedHint(cellStates, regions, size, candidates) {
  for (let row = 0; row < size; row++) {
    if (rowHasShamrock(cellStates, row, size)) continue;
    const rowCells = [];
    for (let c = 0; c < size; c++) if (candidates[row][c]) rowCells.push([row, c]);
    if (rowCells.length === 0) continue;

    const regionIds = new Set(rowCells.map(([r, c]) => regions[r][c]));
    if (regionIds.size === 1) {
      const [regionId] = regionIds;
      const cells = [];
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (regions[r][c] === regionId && r !== row && candidates[r][c]) cells.push([r, c]);
        }
      }
      if (cells.length > 0) {
        return { type: "eliminate", reason: "row-locked", cells, row, regionId };
      }
    }
  }

  for (let col = 0; col < size; col++) {
    if (colHasShamrock(cellStates, col, size)) continue;
    const colCells = [];
    for (let r = 0; r < size; r++) if (candidates[r][col]) colCells.push([r, col]);
    if (colCells.length === 0) continue;

    const regionIds = new Set(colCells.map(([r, c]) => regions[r][c]));
    if (regionIds.size === 1) {
      const [regionId] = regionIds;
      const cells = [];
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (regions[r][c] === regionId && c !== col && candidates[r][c]) cells.push([r, c]);
        }
      }
      if (cells.length > 0) {
        return { type: "eliminate", reason: "column-locked", cells, col, regionId };
      }
    }
  }

  return null;
}

/** Rule 4: a region, row, or column has exactly one candidate cell left. */
function findNakedSingleHint(cellStates, regions, size, candidates) {
  for (let regionId = 0; regionId < size; regionId++) {
    if (regionHasShamrock(cellStates, regions, regionId, size)) continue;
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
    if (rowHasShamrock(cellStates, row, size)) continue;
    const cells = [];
    for (let c = 0; c < size; c++) if (candidates[row][c]) cells.push([row, c]);
    if (cells.length === 1) {
      return { type: "place", reason: "naked-single-row", cells, row };
    }
  }

  for (let col = 0; col < size; col++) {
    if (colHasShamrock(cellStates, col, size)) continue;
    const cells = [];
    for (let r = 0; r < size; r++) if (candidates[r][col]) cells.push([r, col]);
    if (cells.length === 1) {
      return { type: "place", reason: "naked-single-column", cells, col };
    }
  }

  return null;
}

const NO_EXCLUSIONS = new Set();

/**
 * The player's *committed* moves — placed shamrocks only — expressed as
 * constraints for the solver.
 *
 * Deliberately ignores ✕ marks. A ✕ is a scratch note, not a commitment:
 * the player can still place on top of one, and (especially with
 * swipe-to-mark) it's easy to ✕ a cell that actually needs a shamrock.
 * Feeding those marks to the solver as facts would make it reason from a
 * false premise and emit confident nonsense — which is exactly the bug
 * this replaced. Everything the hint engine concludes is derived from
 * placements alone, so no amount of bad marking can corrupt a hint.
 */
function placementConstraints(cellStates, size) {
  const forcedCol = new Array(size).fill(-1);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (cellStates[r][c] === CELL_SHAMROCK) forcedCol[r] = c;
    }
  }
  return forcedCol;
}

/** Every [row, col] the player currently has a shamrock on. */
function placedShamrocks(cellStates, size) {
  const placed = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (cellStates[r][c] === CELL_SHAMROCK) placed.push([r, c]);
    }
  }
  return placed;
}

/**
 * True if the shamrocks already on the board can still be completed into a
 * full valid solution. ✕ marks are ignored — see `placementConstraints`.
 */
export function hasValidCompletion(cellStates, regions, size) {
  const forcedCol = placementConstraints(cellStates, size);
  return countConstrainedSolutions({ size, regions }, forcedCol, NO_EXCLUSIONS, 1) > 0;
}

/**
 * Given a board with no valid completion, works out which placed
 * shamrock(s) are to blame: a shamrock is a culprit if removing it (and
 * nothing else) makes the board completable again. If exactly one comes
 * back, that's definitively the wrong one. If none do, two or more
 * placements are jointly wrong and every placement is suspect.
 */
function findWrongPlacements(cellStates, regions, size) {
  const placed = placedShamrocks(cellStates, size);
  const culprits = [];

  for (const [pr, pc] of placed) {
    const forcedCol = placementConstraints(cellStates, size);
    forcedCol[pr] = -1; // pretend this one isn't there
    if (countConstrainedSolutions({ size, regions }, forcedCol, NO_EXCLUSIONS, 1) > 0) {
      culprits.push([pr, pc]);
    }
  }

  return culprits.length > 0 ? culprits : placed;
}

/**
 * Finds a ✕ the player has put on a cell that provably must hold a
 * shamrock.
 *
 * "Provably" is doing real work here: it isn't enough that the cell shows
 * up in *some* completion, since on a board with more than one completion
 * a different one might avoid it — calling that a mistake would be exactly
 * the kind of confident-but-wrong advice this rewrite exists to kill. A
 * cell is only required if ruling it out leaves no completion at all, so
 * that's what gets checked. Any one completion is still a useful shortlist
 * to test against, because a required cell must appear in every one.
 */
function findWrongMark(cellStates, regions, size) {
  const forcedCol = placementConstraints(cellStates, size);
  const [completion] = findConstrainedSolutions({ size, regions }, forcedCol, NO_EXCLUSIONS, 1);
  if (!completion) return null;

  for (const [r, c] of completion) {
    if (cellStates[r][c] !== CELL_X) continue;
    const withoutThisCell = new Set([key(r, c)]);
    if (countConstrainedSolutions({ size, regions }, forcedCol, withoutThisCell, 1) === 0) {
      return { type: "unmark", reason: "wrong-mark", cells: [[r, c]] };
    }
  }
  return null;
}

/**
 * Rule 6 (last resort — see the module-level comment for why this should
 * essentially never trigger in practice): falls through to constraint
 * propagation and finds one cell whose status is *provably forced* from
 * here, by testing whether assuming the opposite breaks solvability.
 * Doesn't need or consult the precomputed solution at all.
 */
function findForcedHint(derived, regions, size) {
  const forcedCol = placementConstraints(derived, size);
  const excluded = new Set();
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (derived[r][c] === CELL_X) excluded.add(key(r, c));
    }
  }

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

      const assumeShamrock = forcedCol.slice();
      assumeShamrock[row] = col;
      const waysIfShamrock = countConstrainedSolutions({ size, regions }, assumeShamrock, excluded, 1);
      if (waysIfShamrock === 0) {
        return { type: "eliminate", reason: "forced", cells: [[row, col]] };
      }
    }
  }

  return null;
}

/**
 * Runs rules 1-6 against a board state, in escalating order, returning the
 * first deduction that applies. Exported so the individual rules can be
 * unit-tested directly, without `getHint`'s wrong-placement/wrong-mark
 * preamble in the way.
 */
export function deriveDeduction(state, regions, size) {
  const candidates = computeCandidates(state, regions, size);
  return (
    findConflictHint(state, regions, size) ||
    findRegionSubsetHint(state, regions, size, candidates, "row") ||
    findRegionSubsetHint(state, regions, size, candidates, "column") ||
    findAxisLockedHint(state, regions, size, candidates) ||
    findNakedSingleHint(state, regions, size, candidates) ||
    findForcedHint(state, regions, size)
  );
}

const MAX_DERIVATION_STEPS = 400;

/**
 * Finds the next hint for the current board state, or null if the puzzle
 * is already solved.
 *
 * Correctness here matters more than cleverness, because a wrong hint is
 * worse than no hint — it actively walks the player into a dead end. So
 * the engine takes only the player's *placements* as given and re-derives
 * everything else itself, rather than trusting their ✕ marks:
 *
 *   1. If the placements admit no valid completion, nothing downstream is
 *      meaningful — the honest hint is "one of these shamrocks is wrong",
 *      naming the culprit, not a made-up deduction about a dead board.
 *   2. If a ✕ sits on a cell that must hold a shamrock, say so, since
 *      every hint the player derives from that mark themselves will be
 *      wrong too.
 *   3. Otherwise, derive deductions from the placements alone, replaying
 *      the rules internally until one produces something the player hasn't
 *      already marked — so the hint is always both sound and *new*.
 *
 * @param {string[][]} cellStates
 * @param {number[][]} regions
 * @param {number} size
 */
export function getHint(cellStates, regions, size) {
  if (!hasValidCompletion(cellStates, regions, size)) {
    return {
      type: "remove",
      reason: "wrong-placement",
      cells: findWrongPlacements(cellStates, regions, size),
    };
  }

  const wrongMark = findWrongMark(cellStates, regions, size);
  if (wrongMark) return wrongMark;

  // Derived state starts from placements only — the player's ✕ marks are
  // deliberately dropped, then re-derived below, so a bad mark can't feed
  // back into the reasoning.
  const derived = cellStates.map((row) => row.map((s) => (s === CELL_SHAMROCK ? CELL_SHAMROCK : CELL_EMPTY)));

  for (let step = 0; step < MAX_DERIVATION_STEPS; step++) {
    const hint = deriveDeduction(derived, regions, size);
    if (!hint) return null;

    if (hint.type === "place") {
      const [r, c] = hint.cells[0];
      if (cellStates[r][c] !== CELL_SHAMROCK) return hint;
      derived[r][c] = CELL_SHAMROCK;
      continue;
    }

    // Only surface eliminations the player hasn't already marked; anything
    // they've covered is applied internally and the search continues, so
    // repeated Hint presses keep moving forward instead of restating what
    // is already on the board.
    const unseen = hint.cells.filter(([r, c]) => cellStates[r][c] === CELL_EMPTY);
    if (unseen.length > 0) return { ...hint, cells: unseen };

    for (const [r, c] of hint.cells) {
      if (derived[r][c] === CELL_EMPTY) derived[r][c] = CELL_X;
    }
  }

  return null;
}

/**
 * Mechanically drives a board to completion using *only* rules 1-5 (never
 * rule 6's propagation fallback), to verify a puzzle is solvable using
 * nothing but small, glanceable deductions. Used by `generateGrid.js` as a
 * generation-time gate — see the module-level comment for why.
 *
 * @param {number[][]} regions
 * @param {number} size
 * @returns {boolean} true if named rules alone fully solve the board.
 */
export function solveByNamedRules(regions, size) {
  const cellStates = Array.from({ length: size }, () => new Array(size).fill(CELL_EMPTY));
  let placed = 0;

  while (placed < size) {
    const candidates = computeCandidates(cellStates, regions, size);
    const hint =
      findConflictHint(cellStates, regions, size) ||
      findRegionSubsetHint(cellStates, regions, size, candidates, "row") ||
      findRegionSubsetHint(cellStates, regions, size, candidates, "column") ||
      findAxisLockedHint(cellStates, regions, size, candidates) ||
      findNakedSingleHint(cellStates, regions, size, candidates);

    if (!hint) return false;

    if (hint.type === "eliminate") {
      for (const [r, c] of hint.cells) {
        if (cellStates[r][c] === CELL_EMPTY) cellStates[r][c] = CELL_X;
      }
    } else {
      const [r, c] = hint.cells[0];
      cellStates[r][c] = CELL_SHAMROCK;
      placed++;
    }
  }

  return true;
}

const ORDINAL = (n) => `${n + 1}`;

function listRegionNames(regionIds, regionName) {
  const names = regionIds.map(regionName);
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function listOrdinals(values) {
  const words = values.map(ORDINAL);
  if (words.length === 1) return words[0];
  if (words.length === 2) return `${words[0]} and ${words[1]}`;
  return `${words.slice(0, -1).join(", ")}, and ${words[words.length - 1]}`;
}

/**
 * Turns a hint returned by `getHint` into a plain-English explanation.
 * `regionNames` is a plain array (regionId -> name), passed in so this
 * module never has to import the presentation-layer colour palette.
 */
export function describeHint(hint, regionNames) {
  if (!hint) return "No hint available — looks like everything's already deducible from here!";

  const regionName = (id) => regionNames?.[id] ?? `region ${id + 1}`;

  switch (hint.reason) {
    case "wrong-placement": {
      const at = (cell) => `row ${ORDINAL(cell[0])}, column ${ORDINAL(cell[1])}`;
      if (hint.cells.length === 1) {
        return `There's no way to finish the puzzle from here — the shamrock at ${at(
          hint.cells[0]
        )} can't be right. It doesn't break a rule on its own, which is why nothing flagged it, but no arrangement of the rest fits around it. Tap it twice to clear it and carry on from there.`;
      }
      return `There's no way to finish the puzzle from here — more than one shamrock is in the wrong place, so no single one can be pinpointed. The ones still in play are at ${hint.cells
        .map(at)
        .join("; ")}. Clearing the most recent couple is usually the quickest way back.`;
    }
    case "wrong-mark": {
      const [r, c] = hint.cells[0];
      return `Row ${ORDINAL(r)}, column ${ORDINAL(
        c
      )} is marked with an ✕, but that's the one cell in this puzzle where its shamrock has to go. Clear the ✕ — any deduction built on it will lead you astray.`;
    }
    case "conflict": {
      const [r, c] = hint.sourceCell;
      const plural = hint.cells.length > 1 ? "cells" : "cell";
      return `The shamrock at row ${ORDINAL(r)}, column ${ORDINAL(c)} rules out ${hint.cells.length} more ${plural} — each one shares its row, column, or region with that shamrock, or would touch it. Mark them with an ✕.`;
    }
    case "locked-row":
      return `Every remaining candidate cell in ${regionName(hint.regionId)} is in row ${ORDINAL(
        hint.row
      )}. That means row ${ORDINAL(hint.row)}'s shamrock has to come from ${regionName(
        hint.regionId
      )} — so every other cell in that row can be ruled out.`;
    case "locked-column":
      return `Every remaining candidate cell in ${regionName(hint.regionId)} is in column ${ORDINAL(
        hint.col
      )}. That means column ${ORDINAL(hint.col)}'s shamrock has to come from ${regionName(
        hint.regionId
      )} — so every other cell in that column can be ruled out.`;
    case "row-locked":
      return `Row ${ORDINAL(hint.row)}'s only remaining candidates are all in ${regionName(
        hint.regionId
      )}. That means ${regionName(hint.regionId)}'s shamrock has to be in row ${ORDINAL(
        hint.row
      )} — so every other cell in that colour can be ruled out.`;
    case "column-locked":
      return `Column ${ORDINAL(hint.col)}'s only remaining candidates are all in ${regionName(
        hint.regionId
      )}. That means ${regionName(hint.regionId)}'s shamrock has to be in column ${ORDINAL(
        hint.col
      )} — so every other cell in that colour can be ruled out.`;
    case "subset-row": {
      const names = listRegionNames(hint.regionIds, regionName);
      const rows = listOrdinals(hint.rows);
      return `${names} — that's ${hint.regionIds.length} colours — only have room left in rows ${rows}, ${hint.regionIds.length} rows total. Between them they'll fill every shamrock those rows get, so no other colour can use rows ${rows} either.`;
    }
    case "subset-column": {
      const names = listRegionNames(hint.regionIds, regionName);
      const cols = listOrdinals(hint.cols);
      return `${names} — that's ${hint.regionIds.length} colours — only have room left in columns ${cols}, ${hint.regionIds.length} columns total. Between them they'll fill every shamrock those columns get, so no other colour can use columns ${cols} either.`;
    }
    case "naked-single-region":
      return `${regionName(hint.regionId)} has only one cell left that isn't ruled out — its shamrock has to go there.`;
    case "naked-single-row":
      return `Row ${ORDINAL(hint.row)} has only one cell left that isn't ruled out — its shamrock has to go there.`;
    case "naked-single-column":
      return `Column ${ORDINAL(hint.col)} has only one cell left that isn't ruled out — its shamrock has to go there.`;
    case "forced": {
      const [r, c] = hint.cells[0];
      if (hint.type === "place") {
        return `This one takes deeper reasoning: try assuming row ${ORDINAL(r)}'s shamrock is anywhere except column ${ORDINAL(
          c
        )} — every one of those leaves no valid way to finish the rest of the board. So it has to go there.`;
      }
      return `This one takes deeper reasoning: assuming a shamrock at row ${ORDINAL(r)}, column ${ORDINAL(
        c
      )} leaves no valid way to finish the rest of the board — so it can be ruled out.`;
    }
    default:
      return "Here's a cell to look at.";
  }
}
