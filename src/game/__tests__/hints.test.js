import { test } from "node:test";
import assert from "node:assert/strict";
import { getHint, computeCandidates, describeHint, solveByNamedRules } from "../hints.js";
import { createEmptyCellStates, CELL_SHAMROCK, CELL_EMPTY, CELL_X, isSolved } from "../validators.js";
import { generatePuzzle } from "../generateGrid.js";

// Four 2x2 quadrant regions on a 4x4 board — enough structure to exercise
// each deduction rule without needing a full generated puzzle.
const QUADRANT_REGIONS = [
  [0, 0, 1, 1],
  [0, 0, 1, 1],
  [2, 2, 3, 3],
  [2, 2, 3, 3],
];

function cellsToSet(cells) {
  return new Set(cells.map(([r, c]) => `${r},${c}`));
}

test("computeCandidates rules out cells sharing a row/col/region or touching a placed shamrock", () => {
  const size = 4;
  const cellStates = createEmptyCellStates(size);
  cellStates[0][0] = CELL_SHAMROCK;

  const candidates = computeCandidates(cellStates, QUADRANT_REGIONS, size);

  // (0,0) itself and everything it rules out should be false.
  assert.equal(candidates[0][0], false);
  assert.equal(candidates[0][1], false); // same row + region + adjacent
  assert.equal(candidates[1][0], false); // same column + region + adjacent
  assert.equal(candidates[1][1], false); // same region + adjacent
  assert.equal(candidates[0][2], false); // same row
  assert.equal(candidates[3][0], false); // same column

  // Untouched, unrelated cell stays a candidate.
  assert.equal(candidates[2][2], true);
  assert.equal(candidates[3][3], true);
});

test("conflict rule: a placed shamrock produces an eliminate hint for its row/col/region/adjacent cells", () => {
  const size = 4;
  const cellStates = createEmptyCellStates(size);
  cellStates[0][0] = CELL_SHAMROCK;

  const hint = getHint(cellStates, QUADRANT_REGIONS, size);

  assert.equal(hint.type, "eliminate");
  assert.equal(hint.reason, "conflict");
  assert.deepEqual(hint.sourceCell, [0, 0]);
  assert.deepEqual(
    cellsToSet(hint.cells),
    cellsToSet([
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 0],
      [2, 0],
      [3, 0],
      [1, 1],
    ])
  );
});

test("locked-candidate rule: a region confined to one row rules out the rest of that row", () => {
  const size = 4;
  const cellStates = createEmptyCellStates(size);
  // Region 1 (top-right quadrant) = {(0,2),(0,3),(1,2),(1,3)}; eliminate
  // its row-1 cells so its only remaining candidates, (0,2) and (0,3),
  // sit in row 0.
  cellStates[1][2] = CELL_X;
  cellStates[1][3] = CELL_X;

  const hint = getHint(cellStates, QUADRANT_REGIONS, size);

  assert.equal(hint.type, "eliminate");
  assert.equal(hint.reason, "locked-row");
  assert.equal(hint.regionId, 1);
  assert.equal(hint.row, 0);
  assert.deepEqual(
    cellsToSet(hint.cells),
    cellsToSet([
      [0, 0],
      [0, 1],
    ])
  );
});

test("locked-candidate rule: a region confined to one column rules out the rest of that column", () => {
  // Mirror of the row case above, along the other axis — regression test
  // for a bug where the column variant's hint carried a `column` property
  // instead of the `col` property describeHint actually reads, producing
  // a "column NaN" message.
  const size = 4;
  const cellStates = createEmptyCellStates(size);
  // Region 1 (top-right quadrant) = {(0,2),(0,3),(1,2),(1,3)}; eliminate
  // its column-3 cells so its only remaining candidates, (0,2) and (1,2),
  // sit in column 2.
  cellStates[0][3] = CELL_X;
  cellStates[1][3] = CELL_X;

  const hint = getHint(cellStates, QUADRANT_REGIONS, size);

  assert.equal(hint.type, "eliminate");
  assert.equal(hint.reason, "locked-column");
  assert.equal(hint.regionId, 1);
  assert.equal(hint.col, 2);
  assert.deepEqual(
    cellsToSet(hint.cells),
    cellsToSet([
      [2, 2],
      [3, 2],
    ])
  );

  const message = describeHint(hint, ["Brick Red", "Habanero Orange", "Jalapeño Green", "Golden Turmeric"]);
  assert.doesNotMatch(message, /NaN/);
  assert.match(message, /column 3/i);
});

test("naked-single rule: a region down to one candidate must take its shamrock there", () => {
  const size = 4;
  const cellStates = createEmptyCellStates(size);
  // Region 0 (top-left) loses its row-0 cells, leaving (1,0)/(1,1) in row 1.
  cellStates[0][0] = CELL_X;
  cellStates[0][1] = CELL_X;
  // Region 1 (top-right) is reduced to a single remaining candidate,
  // (0,2). Its row (row 0) and column (column 2) both still have other
  // cells belonging to other regions, so those are eliminated too —
  // otherwise the single-cell region would trivially also look
  // "locked" to that row/column and the locked-candidate rule (checked
  // first) would fire instead of the naked-single rule this test targets.
  cellStates[0][3] = CELL_X;
  cellStates[1][2] = CELL_X;
  cellStates[1][3] = CELL_X;
  cellStates[2][2] = CELL_X;
  cellStates[3][2] = CELL_X;

  const hint = getHint(cellStates, QUADRANT_REGIONS, size);

  assert.equal(hint.type, "place");
  assert.equal(hint.reason, "naked-single-region");
  assert.equal(hint.regionId, 1);
  assert.deepEqual(hint.cells, [[0, 2]]);
});

test("axis-locked rule: a row confined to a single region rules out that region elsewhere", () => {
  // Found directly from a real (pre-repair) region layout, on a fresh
  // empty board: row 0's only remaining candidates are all region 0, so
  // region 0's shamrock must be in row 0 — ruling out (1,1), its only other
  // still-open cell.
  const size = 5;
  const regions = [
    [0, 0, 0, 0, 0],
    [2, 0, 1, 1, 1],
    [2, 2, 2, 1, 4],
    [2, 3, 3, 1, 4],
    [3, 3, 3, 4, 4],
  ];
  const cellStates = createEmptyCellStates(size);

  const hint = getHint(cellStates, regions, size);

  assert.equal(hint.type, "eliminate");
  assert.equal(hint.reason, "row-locked");
  assert.equal(hint.row, 0);
  assert.equal(hint.regionId, 0);
  assert.deepEqual(hint.cells, [[1, 1]]);
});

test("subset rule: two regions collectively confined to two rows rule out everyone else from those rows", () => {
  // Found directly from a real (pre-repair) region layout: regions 3 and
  // 4 have no candidates left outside rows 3-4 between them, so — same
  // idea as the single-region case, one level up — no *other* region can
  // use those two rows either.
  const size = 5;
  const regions = [
    [0, 0, 2, 1, 1],
    [0, 0, 2, 1, 1],
    [2, 2, 2, 1, 1],
    [4, 4, 4, 1, 3],
    [4, 4, 4, 3, 3],
  ];
  const cellStates = createEmptyCellStates(size);

  const hint = getHint(cellStates, regions, size);

  assert.equal(hint.type, "eliminate");
  assert.equal(hint.reason, "subset-row");
  assert.deepEqual(hint.regionIds, [3, 4]);
  assert.deepEqual(hint.rows, [3, 4]);
  assert.deepEqual(hint.cells, [[3, 3]]);
});

test("subset rule: two regions collectively confined to two columns rule out everyone else from those columns", () => {
  // Column-axis counterpart of the row case above, found directly from a
  // real (pre-repair) region layout — regions 1 and 4 have no candidates
  // left outside columns 1-2 between them.
  const size = 5;
  const regions = [
    [2, 1, 1, 0, 0],
    [2, 1, 1, 0, 0],
    [2, 1, 1, 3, 0],
    [2, 4, 3, 3, 3],
    [2, 4, 4, 3, 3],
  ];
  const cellStates = createEmptyCellStates(size);

  const hint = getHint(cellStates, regions, size);

  assert.equal(hint.type, "eliminate");
  assert.equal(hint.reason, "subset-column");
  assert.deepEqual(hint.regionIds, [1, 4]);
  assert.deepEqual(hint.cols, [1, 2]);
  assert.deepEqual(hint.cells, [[3, 2]]);

  const message = describeHint(hint, ["Brick Red", "Habanero Orange", "Jalapeño Green", "Golden Turmeric", "Cocoa"]);
  assert.doesNotMatch(message, /NaN/);
});

test("solveByNamedRules solves a real generated puzzle using only rules 1-5, and rejects a genuinely ambiguous board", () => {
  // generateGrid.js requires exactly this property of every puzzle it
  // ships, so a real generated board must pass here.
  const puzzle = generatePuzzle({ size: 5, seed: "solve-named-rules-check" });
  assert.equal(solveByNamedRules(puzzle.regions, puzzle.size), true);

  // A genuinely ambiguous board (two valid solutions, nothing forced from
  // the start) must correctly fail rather than claim success.
  assert.equal(solveByNamedRules(QUADRANT_REGIONS, 4), false);
});

test("still offers an honest partial deduction on an ambiguous board, without resolving the ambiguity", () => {
  // QUADRANT_REGIONS has exactly two valid solutions —
  // [(0,1),(1,3),(2,0),(3,2)] and [(0,2),(1,0),(2,3),(3,1)] — and no row
  // can be fully pinned yet. But (0,0) happens to be absent from *both* of
  // them, so ruling it out is still a legitimate, honest deduction (true
  // in every remaining possibility), not a guess between the two answers.
  const size = 4;
  const cellStates = createEmptyCellStates(size);

  const hint = getHint(cellStates, QUADRANT_REGIONS, size);

  assert.equal(hint.type, "eliminate");
  assert.equal(hint.reason, "forced");
  assert.deepEqual(hint.cells, [[0, 0]]);
});

test("never fabricates a full solve on a genuinely ambiguous board", () => {
  // Mechanically apply every hint getHint offers until it runs out. Since
  // the two solutions above never fully agree, it must eventually get
  // stuck (return null) rather than ever confidently claiming the board
  // is solved — that would mean it had silently picked one answer over
  // the other, i.e. guessed.
  const size = 4;
  let cellStates = createEmptyCellStates(size);
  let hint;
  let steps = 0;

  while ((hint = getHint(cellStates, QUADRANT_REGIONS, size)) && steps < 50) {
    if (hint.type === "eliminate") {
      for (const [r, c] of hint.cells) {
        if (cellStates[r][c] === CELL_EMPTY) cellStates[r][c] = CELL_X;
      }
    } else {
      const [r, c] = hint.cells[0];
      cellStates[r][c] = CELL_SHAMROCK;
    }
    steps++;
  }

  assert.equal(hint, null, "should get stuck rather than loop forever or fabricate progress");
  assert.equal(isSolved(cellStates, QUADRANT_REGIONS), false, "must never claim an ambiguous board is solved");
});

test("forced rule: finds a deduction beyond the named patterns, with no solution passed in at all", () => {
  // A raw (not yet uniqueness/named-rule-repaired) region layout where,
  // on the very first move, none of the named patterns (conflict/locked/
  // subset/axis-locked/naked-single) fire, but full constraint
  // propagation can still prove (1,1) is impossible. getHint is called
  // with no solution argument, so this can only be legitimate reasoning.
  // (Real generated puzzles are specifically repaired to avoid ever
  // needing this tier — see generateGrid.js — so a raw layout is used
  // here purely to exercise the rule 6 code path at all.)
  const size = 5;
  const regions = [
    [0, 0, 0, 0, 0],
    [2, 2, 1, 1, 1],
    [2, 2, 1, 1, 3],
    [2, 2, 4, 3, 3],
    [4, 4, 4, 4, 3],
  ];
  const cellStates = createEmptyCellStates(size);

  const hint = getHint(cellStates, regions, size);

  assert.equal(hint.type, "eliminate");
  assert.equal(hint.reason, "forced");
  assert.deepEqual(hint.cells, [[1, 1]]);
});

test("describeHint produces a non-empty, rule-appropriate sentence for every reason", () => {
  const size = 4;
  const regionNames = ["Brick Red", "Habanero Orange", "Jalapeño Green", "Golden Turmeric"];

  const conflictHint = { type: "eliminate", reason: "conflict", cells: [[0, 1]], sourceCell: [0, 0] };
  assert.match(describeHint(conflictHint, regionNames), /rules out/i);

  const lockedHint = { type: "eliminate", reason: "locked-row", cells: [[0, 3]], regionId: 1, row: 0 };
  assert.match(describeHint(lockedHint, regionNames), new RegExp(regionNames[1]));

  const nakedHint = { type: "place", reason: "naked-single-row", cells: [[0, 2]], row: 0 };
  assert.match(describeHint(nakedHint, regionNames), /has to go there/i);

  const forcedHint = { type: "eliminate", reason: "forced", cells: [[0, 1]] };
  assert.match(describeHint(forcedHint, regionNames), /no valid way/i);

  assert.match(describeHint(null, regionNames), /no hint/i);
  void size;
});
