# Lucky Patch ☘️

A shamrock-themed daily logic puzzle in the spirit of LinkedIn's *Queens*. Place one shamrock in every row,
column, and coloured region — no two shamrocks may touch, not even diagonally.

Riso-print branding: electric pink + funky purple, halftone textures, offset-print title.

## Setup

```bash
npm install
npm run dev
```

Open the printed local URL (usually `http://localhost:5173`) and play. A fresh puzzle generates on every
page load; click **New puzzle** for another.

Other scripts:

```bash
npm run build      # production build to dist/
npm run preview    # serve the production build locally
npm test           # run the game-logic test suite (node:test, no browser needed)
```

## How the puzzle is generated

All of this lives in `src/game/` and has zero React/DOM dependencies, so it's portable and independently
testable.

1. **`generateGrid.js` → `generateSolution`**: finds a valid shamrock placement — one per row and column —
   such that no two placed shamrocks touch. Because every row has exactly one shamrock, two placed shamrocks
   can only ever be adjacent if their rows are next to each other, so the search just needs to keep
   consecutive rows' columns more than one apart. Randomised backtracking means different seeds produce
   different solutions.

2. **`generateGrid.js` → `growRegions`**: grows N irregular regions outward from the solution cells with a
   randomised flood fill. At each step, growth is offered to whichever region currently has the *fewest*
   cells (ties broken randomly) — not a fixed turn order — so a region that gets boxed in by its neighbours
   simply stops growing while the smallest-first rule keeps sizes close to even. This is what gives regions
   their jigsaw-piece look instead of straight rows/blocks.

3. **`solver.js`**: a constraint solver (`findSolutions`) that backtracks over the board the same way a
   player would — one shamrock per row, column, and region, no touching — and can return more than one found
   solution if they exist.

4. **`generateGrid.js` → `repairToUnique`**: a random region partition is *rarely* uniquely solvable on the
   first try — in testing, layouts balanced enough to look good were essentially never unique by chance,
   while forcing them to a fully random unbalanced shape was unique often but looked bad (one region eating
   half the board). Instead of retrying from scratch until balance and uniqueness happen to coincide, this
   step takes a layout with two-or-more valid solutions and nudges it: it grabs two of those solutions,
   finds a boundary cell used by one of them that borders a *different* region also used by that same
   solution, and reassigns just that one cell — which invalidates that particular solution without
   touching the other one — as long as the move keeps both regions connected and non-empty. Repeats until
   only one solution remains (or it gets stuck, in which case the outer loop just starts over with a fresh
   solution/region pair). This keeps the nice, even region sizes from step 2 while still landing on a
   unique puzzle almost every time.

5. **`hints.js` → `solveByNamedRules`**: a unique solution doesn't by itself guarantee the puzzle is
   solvable *without guessing* — a board can have exactly one valid answer while still having a point
   partway through with no move a player can actually justify by looking at the board. (Empirically this
   turned out to be the common case, not an edge case — see the "On hints" section below for the numbers.)
   `solveByNamedRules` mechanically drives the board using nothing but `getHint`'s named, glanceable rules
   (never its constraint-propagation last resort) and reports whether that alone fully solves it.
   `generatePuzzle` rejects and regenerates any board this can't fully resolve, same as a non-unique one.

6. **`solver.js` → `solveByPropagation`**: run as a belt-and-suspenders check *in addition to* step 5.
   It's strictly more powerful than the named rules — for every undetermined cell, it tests whether
   *assuming the opposite* of each possibility breaks solvability entirely, which can prove a cell forced
   even when no named pattern applies — so it should always already be true once step 5 passes. It's kept
   as an independent check purely as a safety net against a bug in the named-rule logic, not because it's
   expected to catch anything on its own.

7. **`generatePuzzle({ size, seed })`** ties it together and accepts a `seed` (any string/number) so the
   same seed always regenerates the exact same puzzle — the hook a future "daily puzzle" feature needs.
   Omit `seed` for a random puzzle each call.

### Region colours

`components/palette.js` holds a curated, food-themed colour list, but region *shape* is random — index-order
assignment could put two similar warm tones right next to each other. `components/colorMath.js` converts
each colour to CIE Lab and `components/regionColorAssignment.js` uses that to actually pick which region
gets which palette colour: it builds the on-screen adjacency graph between regions (including diagonal
neighbours, since corner-touching regions read as "next to each other" too) and greedily assigns colours so
that touching regions end up as perceptually distant as the palette allows. `palette.js` also picks a
contrast-safe icon colour (white or dark ink) per region so the shamrock/✕ glyph stays legible on both bright
and dark backgrounds.

### Hints

`game/hints.js` is a small deduction engine, not an answer-revealer — `getHint` runs a handful of rules a
human player can actually verify by looking at a small, fixed set of cells and counting (never "assume X
and check the whole rest of the board"), in order from easiest to spot to hardest, and stops at the first
one that applies:

1. **Conflict** — a placed shamrock rules out the rest of its row/column/region and the cells touching it.
2. **Region-locked** — a region's remaining candidates all sit in one row (or column), so that row's/column's
   shamrock has to come from this region, ruling out everything else in it.
3. **Axis-locked** — the mirror image of #2: a row's (or column's) remaining candidates all sit in one
   region, so that region's shamrock has to be in this row, ruling out everything else in the region.
4. **Naked single** — a row, column, or region is down to exactly one candidate cell, so it must hold the
   shamrock.
5. **Subset-locked** — a generalisation of #2: two or three regions, considered together, have all their
   remaining candidates confined to exactly that many rows (or columns) between them — since each needs a
   different one and there are exactly enough to go around, no *other* region can use any of those either.
6. **Forced** — every rule above failed to make progress. Falls through to `solver.js`'s constraint
   propagation (assume the opposite, check whether *any* completion of the whole board remains) — this is
   the same reasoning `solveByPropagation` uses, and it's strictly more powerful than rules 1-5, but a
   player can't verify it by eye. This tier exists purely as defensive code; it should never actually
   trigger during normal play, because every generated puzzle is already required to be solvable using only
   rules 1-5 (see `solveByNamedRules` above) before it's ever shown to a player.

`describeHint` turns whichever rule fired into a plain-English explanation; the UI highlights the affected
cell(s) rather than applying the hint automatically, so the player still makes the move themselves.

### Hints only trust placements, never ✕ marks

A wrong hint is worse than no hint — it walks the player into a dead end while sounding authoritative. So
`getHint` takes only the player's *placed shamrocks* as given and re-derives everything else itself. It
specifically does **not** treat ✕ marks as fact: a ✕ is a scratch note, the player can still place on top of
one, and with swipe-to-mark it's very easy to ✕ a cell that actually needs a shamrock. Before reasoning at
all, it checks two things:

- **Are the placements still completable?** If not, the honest answer isn't a deduction — it's "one of these
  shamrocks is wrong". `findWrongPlacements` pinpoints the culprit by testing which single removal makes the
  board completable again.
- **Is a ✕ sitting on a cell that must hold a shamrock?** Reported directly, since every deduction the player
  makes from that mark will also be wrong. "Must" is verified properly — a cell only counts as required if
  *ruling it out* leaves no completion, not merely because it appears in one solution among several.

Only then does it derive deductions, replaying the rules internally against a board rebuilt from placements
alone until it finds something the player hasn't already marked. That last part is what keeps repeated Hint
presses moving forward instead of restating what's already on the board.

This exists because of a real bug found in play. The engine used to feed ✕ marks straight into its candidate
set and never checked completability. Measured on 60 puzzles: a legal-but-wrong placement made the board
unfinishable **60/60 times**, the mistake counter (which only ever caught immediate rule violations) flagged
**0 of them**, and the hint engine went right on emitting confident advice about a dead board **60/60 times**.
`src/game/__tests__/hintSoundness.test.js` now pins all of this down, including that no hint ever rules out a
cell that is genuinely part of the solution.

**Dead ends are surfaced immediately.** `hasValidCompletion` runs on every board change (sub-millisecond at
these sizes), and `DeadEndBanner` tells the player the moment their placements stop admitting a finish —
rather than letting them work a doomed board for minutes. Hints that flag a player mistake get a distinct
rose treatment and ring the offending cell, so a correction never reads as "do this next".

**Why rule 6 exists but (in practice) never fires:** the first version of this generator only checked that a
puzzle had a unique solution, and separately, a hint engine with just rules 1, 2, and 4 above. Those two
facts turned out not to compose the way you'd hope — checking mechanically, **only 4 of 100** generated
puzzles were actually solvable using those rules alone; the rest hit a point where the only way to make
progress was opaque "assume a placement and verify the entire rest of the board still solves" reasoning,
which a player can't do by eye and which isn't meaningfully different from guessing. Rules 3 and 5 above
were added specifically to close that gap, and `generatePuzzle` now *requires* rules 1-5 to fully solve a
board before shipping it — with that gate in place, checking the same way found **0 of 40** generated
puzzles needing rule 6 at all. `src/game/__tests__/hints.test.js` and `solver.test.js` cover this directly,
including negative cases (deliberately ambiguous boards) confirming the checkers correctly report "not
solvable this way" rather than papering over real ambiguity.

### Tuning difficulty / look

- **Board size**: `generatePuzzle({ size })` — the UI currently hardcodes `BOARD_SIZE = 8` in `src/App.jsx`.
  Requiring named-rule solvability (not just uniqueness) is a much stricter filter — most random layouts
  fail it, so generation now retries considerably more than it used to before finding one that passes. In
  testing, size 8 still generates in ~50ms on average (fine for an interactive click); size 9 averages
  several hundred ms and size 10 can take seconds, so sizes above 8 aren't currently exposed in the UI —
  raising the default would want a loading state, and possibly a smarter generation strategy than retry-
  until-lucky for the larger sizes.
- **Region balance**: `growRegions`'s smallest-first rule is what keeps regions even; there's no separate
  tunable knob today, but a max-region-size cap could be reintroduced in `generateGrid.js` if you want to
  force even tighter balance (at some cost to generation speed/success rate).
- **Generation budget**: `MAX_OUTER_ATTEMPTS` and `MAX_REPAIR_STEPS` at the top of `generateGrid.js` bound
  how hard generation tries (uniqueness repair, then the named-rule and propagation checks) before giving
  up. Raise them if you push board size up and start seeing generation failures.

## Project structure

```
src/
  game/                  # framework-agnostic puzzle logic (no React/DOM)
    rng.js               # seeded PRNG
    generateGrid.js       # solution + region generation, uniqueness repair
    solver.js             # constraint solver (count / find solutions)
    validators.js         # adjacency, row/col/region conflict checks, win check
    hints.js               # deduction-rule hint engine + mistake detection
    __tests__/            # node:test suite, incl. hintSoundness.test.js
  components/
    palette.js                  # region colour palette + contrast-safe icon colour
    colorMath.js                 # Lab conversion / distance, contrast ratio helpers
    regionColorAssignment.js     # assigns palette colours so touching regions stay distinct
    ShamrockIcon.jsx
    Board.jsx / Cell.jsx
    Header.jsx / Timer.jsx
    HowToPlayModal.jsx / WinModal.jsx / HintPanel.jsx
    DeadEndBanner.jsx        # warns when placements admit no finish
    Footer.jsx             # credit line
  App.jsx                  # game state, timer, win detection, hint wiring
  main.jsx
  index.css                # Tailwind + riso texture utilities
```

## Deploying (not set up yet — notes for later)

This is a static, client-only app — no backend, no env vars, no build-time secrets.

- **Build command**: `npm run build` → outputs static files to `dist/`.
- **Base path**: `vite.config.js` sets `base: "./"`, so the build works from any sub-path (a custom domain
  root, a GitHub Pages project path, etc.) without extra config.
- **Hosting**: drop `dist/` on Vercel, Netlify, GitHub Pages, Cloudflare Pages, or any static file host.
  No server-side rendering or API routes are involved.
- **Fonts**: `index.html` currently loads Space Grotesk/Inter from Google Fonts over the network. For
  fully offline/self-hosted builds, swap that `<link>` for locally bundled font files.

## Future work (out of scope for this build)

- Daily puzzle scheduling (the `seed` param already supports it — just needs a date → seed mapping and a
  place to persist "today's" puzzle)
- Leaderboards / accounts / backend
- Shareable result summaries
- Configurable board size in the UI
