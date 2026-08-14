import { test } from "node:test";
import assert from "node:assert/strict";
import { countSolutions, countConstrainedSolutions, solveByPropagation, findSolution } from "../solver.js";
import { generatePuzzle } from "../generateGrid.js";

const QUADRANT_REGIONS = [
  [0, 0, 1, 1],
  [0, 0, 1, 1],
  [2, 2, 3, 3],
  [2, 2, 3, 3],
];

test("countConstrainedSolutions respects pinned rows and excluded cells", () => {
  const size = 4;
  // Fully unconstrained: same as plain countSolutions.
  const unconstrained = countConstrainedSolutions(
    { size, regions: QUADRANT_REGIONS },
    new Array(size).fill(-1),
    new Set(),
    10
  );
  assert.equal(unconstrained, countSolutions({ size, regions: QUADRANT_REGIONS }, 10));

  // Pin row 0 to a column that has no valid completion (adjacent to nothing
  // useful) — excluding every column should drop the count to 0.
  const allExcluded = new Set();
  for (let c = 0; c < size; c++) allExcluded.add(`0,${c}`);
  const noneLeft = countConstrainedSolutions({ size, regions: QUADRANT_REGIONS }, new Array(size).fill(-1), allExcluded, 10);
  assert.equal(noneLeft, 0);
});

test("solveByPropagation reports unsolved for a genuinely ambiguous board", () => {
  // Four symmetric 2x2 regions have two equally valid solutions and no
  // starting deduction can favour one over the other — a real player would
  // have to guess. The checker must say so rather than picking one.
  const result = solveByPropagation({ size: 4, regions: QUADRANT_REGIONS });
  assert.equal(result.solved, false);
  assert.ok(result.forcedCol.every((c) => c === -1));
});

test("solveByPropagation immediately forces a single-cell region", () => {
  const size = 4;
  // Region 0 is just (0,0) — its row's shamrock is forced from the very
  // first pass, with no other deduction needed first.
  const regions = [
    [0, 1, 1, 1],
    [1, 2, 1, 1],
    [1, 2, 2, 3],
    [1, 2, 3, 3],
  ];
  const result = solveByPropagation({ size, regions });
  assert.equal(result.forcedCol[0], 0);
});

test("solveByPropagation fully resolves real generated puzzles without guessing, matching the true solution", () => {
  for (let i = 0; i < 20; i++) {
    const puzzle = generatePuzzle({ size: 8, seed: `propagation-check-${i}` });
    const result = solveByPropagation({ size: puzzle.size, regions: puzzle.regions });

    assert.equal(result.solved, true, `seed ${i}: puzzle should be fully solvable by forced deduction alone`);

    const trueSolution = findSolution({ size: puzzle.size, regions: puzzle.regions });
    const trueCols = new Array(puzzle.size).fill(-1);
    for (const [r, c] of trueSolution) trueCols[r] = c;

    assert.deepEqual(result.forcedCol, trueCols, `seed ${i}: forced solution should match the actual unique solution`);
  }
});
