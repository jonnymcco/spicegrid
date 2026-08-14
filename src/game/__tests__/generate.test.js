import { test } from "node:test";
import assert from "node:assert/strict";
import { generatePuzzle } from "../generateGrid.js";
import { countSolutions } from "../solver.js";
import { findConflicts, isSolved, createEmptyCellStates, CELL_CHILLI } from "../validators.js";

test("generates a puzzle with exactly one solution, for several sizes", () => {
  for (const size of [4, 5, 6, 8]) {
    const puzzle = generatePuzzle({ size, seed: `test-${size}` });
    assert.equal(puzzle.solution.length, size);

    const solutionCount = countSolutions({ size: puzzle.size, regions: puzzle.regions }, 2);
    assert.equal(solutionCount, 1, `size ${size} should have exactly one solution`);
  }
});

test("every region is used exactly once by the solution and covers the whole board", () => {
  const puzzle = generatePuzzle({ size: 8, seed: "coverage-check" });
  const seen = new Set();
  for (let r = 0; r < puzzle.size; r++) {
    for (let c = 0; c < puzzle.size; c++) {
      assert.ok(puzzle.regions[r][c] >= 0 && puzzle.regions[r][c] < puzzle.size);
      seen.add(puzzle.regions[r][c]);
    }
  }
  assert.equal(seen.size, puzzle.size);
});

test("same seed produces an identical puzzle", () => {
  const a = generatePuzzle({ size: 8, seed: "2026-08-14" });
  const b = generatePuzzle({ size: 8, seed: "2026-08-14" });
  assert.deepEqual(a.regions, b.regions);
  assert.deepEqual(a.solution, b.solution);
});

test("different seeds usually produce different puzzles", () => {
  const a = generatePuzzle({ size: 8, seed: "seed-a" });
  const b = generatePuzzle({ size: 8, seed: "seed-b" });
  assert.notDeepEqual(a.regions, b.regions);
});

test("validators: the generated solution itself is accepted as solved", () => {
  const puzzle = generatePuzzle({ size: 8, seed: "solved-check" });
  const cellStates = createEmptyCellStates(puzzle.size);
  for (const [r, c] of puzzle.solution) cellStates[r][c] = CELL_CHILLI;

  assert.equal(findConflicts(cellStates, puzzle.regions).size, 0);
  assert.equal(isSolved(cellStates, puzzle.regions), true);
});

test("validators: adjacent chillies are flagged as conflicts", () => {
  const puzzle = generatePuzzle({ size: 6, seed: "conflict-check" });
  const cellStates = createEmptyCellStates(puzzle.size);
  cellStates[0][0] = CELL_CHILLI;
  cellStates[1][1] = CELL_CHILLI; // diagonally touching (0,0)

  const conflicts = findConflicts(cellStates, puzzle.regions);
  assert.ok(conflicts.has("0,0"));
  assert.ok(conflicts.has("1,1"));
});

test("validators: sharing a row is flagged as a conflict", () => {
  const puzzle = generatePuzzle({ size: 6, seed: "row-conflict" });
  const cellStates = createEmptyCellStates(puzzle.size);
  cellStates[3][0] = CELL_CHILLI;
  cellStates[3][5] = CELL_CHILLI;

  const conflicts = findConflicts(cellStates, puzzle.regions);
  assert.ok(conflicts.has("3,0"));
  assert.ok(conflicts.has("3,5"));
});
