import { test } from "node:test";
import assert from "node:assert/strict";
import { generatePuzzle } from "../generateGrid.js";
import { getHint, describeHint, hasValidCompletion } from "../hints.js";
import { findSolutions } from "../solver.js";
import { createEmptyCellStates, CELL_SHAMROCK, CELL_X, CELL_EMPTY, isSolved } from "../validators.js";

// These tests exist because of a real bug: the hint engine used to treat
// the player's ✕ marks as established fact and never checked whether the
// board was still finishable. A single wrong mark or a legal-but-doomed
// placement therefore had it reasoning from a contradiction and emitting
// confident nonsense — and the player was never told the board had died.
// A wrong hint is worse than no hint, so these are the guardrails.

const SIZE = 8;
const TRIALS = 25;

function solutionKeys(puzzle) {
  return new Set(puzzle.solution.map(([r, c]) => `${r},${c}`));
}

test("every hint on a clean board is sound: nothing it rules out is ever part of the solution", () => {
  for (let trial = 0; trial < TRIALS; trial++) {
    const puzzle = generatePuzzle({ size: SIZE, seed: `sound-clean-${trial}` });
    const truth = solutionKeys(puzzle);
    const cellStates = createEmptyCellStates(SIZE);
    let steps = 0;

    while (!isSolved(cellStates, puzzle.regions) && steps < 500) {
      const hint = getHint(cellStates, puzzle.regions, SIZE);
      assert.ok(hint, `seed ${trial}: got stuck with no hint available`);

      if (hint.type === "place") {
        const [r, c] = hint.cells[0];
        assert.ok(truth.has(`${r},${c}`), `seed ${trial}: told to place at ${r},${c}, which is not in the solution`);
        cellStates[r][c] = CELL_SHAMROCK;
      } else {
        for (const [r, c] of hint.cells) {
          assert.ok(!truth.has(`${r},${c}`), `seed ${trial}: told to rule out ${r},${c}, which IS in the solution`);
          if (cellStates[r][c] === CELL_EMPTY) cellStates[r][c] = CELL_X;
        }
      }
      steps++;
    }

    assert.equal(isSolved(cellStates, puzzle.regions), true, `seed ${trial}: hints did not finish the puzzle`);
  }
});

test("the generated solution really is the only one (exhaustive, not capped)", () => {
  for (let trial = 0; trial < TRIALS; trial++) {
    const puzzle = generatePuzzle({ size: SIZE, seed: `exhaustive-${trial}` });
    const all = findSolutions({ size: puzzle.size, regions: puzzle.regions }, 1000);
    assert.equal(all.length, 1, `seed ${trial}: expected exactly 1 solution, found ${all.length}`);

    const truth = solutionKeys(puzzle);
    const found = new Set(all[0].map(([r, c]) => `${r},${c}`));
    assert.deepEqual(found, truth, `seed ${trial}: reported solution differs from the real one`);
  }
});

test("a legal-but-wrong placement is reported as such, not papered over with a bogus deduction", () => {
  for (let trial = 0; trial < TRIALS; trial++) {
    const puzzle = generatePuzzle({ size: SIZE, seed: `wrong-place-${trial}` });
    const truth = solutionKeys(puzzle);

    // A cell that breaks no rule on an empty board but isn't in the solution.
    let target = null;
    for (let r = 0; r < SIZE && !target; r++) {
      for (let c = 0; c < SIZE && !target; c++) {
        if (!truth.has(`${r},${c}`)) target = [r, c];
      }
    }
    const [tr, tc] = target;
    const cellStates = createEmptyCellStates(SIZE);
    cellStates[tr][tc] = CELL_SHAMROCK;

    assert.equal(hasValidCompletion(cellStates, puzzle.regions, SIZE), false);

    const hint = getHint(cellStates, puzzle.regions, SIZE);
    assert.equal(hint.reason, "wrong-placement", `seed ${trial}: dead board did not report a wrong placement`);
    assert.ok(
      hint.cells.some(([r, c]) => r === tr && c === tc),
      `seed ${trial}: wrong placement at ${tr},${tc} was not among the cells blamed`
    );
    assert.match(describeHint(hint, []), /no way to finish/i);
  }
});

test("a ✕ on a cell that must hold a shamrock is called out, and only when genuinely forced", () => {
  for (let trial = 0; trial < TRIALS; trial++) {
    const puzzle = generatePuzzle({ size: SIZE, seed: `wrong-mark-${trial}` });
    const [solutionRow, solutionCol] = puzzle.solution[3];

    const cellStates = createEmptyCellStates(SIZE);
    cellStates[solutionRow][solutionCol] = CELL_X;

    const hint = getHint(cellStates, puzzle.regions, SIZE);
    assert.equal(hint.reason, "wrong-mark", `seed ${trial}: a ✕ on a required cell went unreported`);
    assert.deepEqual(hint.cells, [[solutionRow, solutionCol]]);
    assert.match(describeHint(hint, []), /has to go|✕/i);
  }
});

test("hints stay sound even when the board is smothered in wrong ✕ marks", () => {
  // The reported failure mode: a whole row swiped out, including the cell
  // that row's shamrock belongs in. Marks must never be taken as fact.
  for (let trial = 0; trial < TRIALS; trial++) {
    const puzzle = generatePuzzle({ size: SIZE, seed: `smothered-${trial}` });
    const truth = solutionKeys(puzzle);
    const cellStates = createEmptyCellStates(SIZE);
    for (let c = 0; c < SIZE; c++) cellStates[2][c] = CELL_X;

    const hint = getHint(cellStates, puzzle.regions, SIZE);
    assert.ok(hint, `seed ${trial}: no hint offered on a heavily marked board`);

    if (hint.type === "eliminate") {
      for (const [r, c] of hint.cells) {
        assert.ok(!truth.has(`${r},${c}`), `seed ${trial}: ruled out ${r},${c}, which is in the solution`);
      }
    } else if (hint.type === "place") {
      const [r, c] = hint.cells[0];
      assert.ok(truth.has(`${r},${c}`), `seed ${trial}: told to place at a non-solution cell`);
    }
  }
});

test("repeated hints keep making progress instead of restating what is already marked", () => {
  const puzzle = generatePuzzle({ size: SIZE, seed: "progress-check" });
  const cellStates = createEmptyCellStates(SIZE);

  const first = getHint(cellStates, puzzle.regions, SIZE);
  for (const [r, c] of first.cells) {
    if (first.type === "place") cellStates[r][c] = CELL_SHAMROCK;
    else cellStates[r][c] = CELL_X;
  }

  const second = getHint(cellStates, puzzle.regions, SIZE);
  assert.ok(second, "second hint should exist");
  const stillUnmarked = second.cells.some(([r, c]) => cellStates[r][c] === CELL_EMPTY);
  assert.ok(stillUnmarked, "a follow-up hint must point at something not already marked");
});
