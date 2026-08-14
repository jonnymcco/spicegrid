import { test } from "node:test";
import assert from "node:assert/strict";
import { getHint, computeCandidates, describeHint } from "../hints.js";
import { createEmptyCellStates, CELL_CHILLI, CELL_EMPTY, CELL_X, isSolved } from "../validators.js";

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

test("computeCandidates rules out cells sharing a row/col/region or touching a placed chilli", () => {
  const size = 4;
  const cellStates = createEmptyCellStates(size);
  cellStates[0][0] = CELL_CHILLI;

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

test("conflict rule: a placed chilli produces an eliminate hint for its row/col/region/adjacent cells", () => {
  const size = 4;
  const cellStates = createEmptyCellStates(size);
  cellStates[0][0] = CELL_CHILLI;

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

test("naked-single rule: a region down to one candidate must take its chilli there", () => {
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
      cellStates[r][c] = CELL_CHILLI;
    }
    steps++;
  }

  assert.equal(hint, null, "should get stuck rather than loop forever or fabricate progress");
  assert.equal(isSolved(cellStates, QUADRANT_REGIONS), false, "must never claim an ambiguous board is solved");
});

test("forced rule: finds a deduction beyond the named patterns, with no solution passed in at all", () => {
  // Taken from a real generated 6x6 puzzle: on the very first move, none
  // of the named patterns (conflict/locked/naked-single) fire, but full
  // constraint propagation can still prove (0,0) is impossible — getHint
  // is called with no solution argument, so this can only be legitimate.
  const size = 6;
  const regions = [
    [2, 2, 0, 0, 0, 1],
    [4, 2, 0, 3, 1, 1],
    [4, 2, 3, 3, 3, 3],
    [4, 2, 5, 3, 3, 3],
    [4, 4, 5, 5, 3, 3],
    [5, 5, 5, 3, 3, 3],
  ];
  const cellStates = createEmptyCellStates(size);

  const hint = getHint(cellStates, regions, size);

  assert.equal(hint.type, "eliminate");
  assert.equal(hint.reason, "forced");
  assert.deepEqual(hint.cells, [[0, 0]]);
});

test("describeHint produces a non-empty, rule-appropriate sentence for every reason", () => {
  const size = 4;
  const regionNames = ["Chilli Red", "Habanero Orange", "Jalapeño Green", "Golden Turmeric"];

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
