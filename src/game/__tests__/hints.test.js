import { test } from "node:test";
import assert from "node:assert/strict";
import { getHint, computeCandidates, describeHint } from "../hints.js";
import { createEmptyCellStates, CELL_CHILLI, CELL_X } from "../validators.js";

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

test("fallback rule: uses the known solution when no deduction rule applies yet", () => {
  const size = 4;
  const cellStates = createEmptyCellStates(size);
  const solution = [
    [0, 0],
    [1, 2],
    [2, 1],
    [3, 3],
  ];

  const hint = getHint(cellStates, QUADRANT_REGIONS, size, solution);

  assert.equal(hint.type, "eliminate");
  assert.equal(hint.reason, "fallback");
  assert.deepEqual(hint.cells, [[0, 1]]);
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

  const fallbackHint = { type: "eliminate", reason: "fallback", cells: [[0, 1]] };
  assert.match(describeHint(fallbackHint, regionNames), /isn't part of the solution/i);

  assert.match(describeHint(null, regionNames), /no hint/i);
  void size;
});
