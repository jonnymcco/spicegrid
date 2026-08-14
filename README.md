# Spice Grid 🌶️

A chilli-themed daily logic puzzle in the spirit of LinkedIn's *Queens*. Place one chilli in every row,
column, and coloured region — no two chillies may touch, not even diagonally.

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

1. **`generateGrid.js` → `generateSolution`**: finds a valid chilli placement — one per row and column —
   such that no two placed chillies touch. Because every row has exactly one chilli, two placed chillies
   can only ever be adjacent if their rows are next to each other, so the search just needs to keep
   consecutive rows' columns more than one apart. Randomised backtracking means different seeds produce
   different solutions.

2. **`generateGrid.js` → `growRegions`**: grows N irregular regions outward from the solution cells with a
   randomised flood fill. At each step, growth is offered to whichever region currently has the *fewest*
   cells (ties broken randomly) — not a fixed turn order — so a region that gets boxed in by its neighbours
   simply stops growing while the smallest-first rule keeps sizes close to even. This is what gives regions
   their jigsaw-piece look instead of straight rows/blocks.

3. **`solver.js`**: a constraint solver (`findSolutions`) that backtracks over the board the same way a
   player would — one chilli per row, column, and region, no touching — and can return more than one found
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

5. **`solver.js` → `solveByPropagation`**: a unique solution doesn't by itself guarantee the puzzle is
   solvable *without guessing* — it's possible for a board to have exactly one valid answer while still
   having a point partway through with no single provably-forced next move, only several branches that all
   still look possible. (Empirically, this turned out to be the common case, not an edge case: an earlier
   version of this project only checked uniqueness, and a spot-check found ~99% of "unique" boards had no
   forced first move at all.) `solveByPropagation` checks the stronger property directly: repeatedly, for
   every undetermined cell, it tests whether *assuming the opposite* of each possibility breaks solvability
   entirely — if assuming a cell is empty leaves no valid completion, that cell must hold the chilli; if
   assuming it holds the chilli leaves no valid completion, it can be ruled out. Applying every such forced
   deduction it finds, on repeat, either resolves the whole board (provably solvable step-by-step, no
   guessing, ever) or gets stuck with real ambiguity remaining.

6. **`generatePuzzle({ size, seed })`** ties it together, rejecting (and regenerating) any board that isn't
   fully solvable per step 5, and accepts a `seed` (any string/number) so the same seed always regenerates
   the exact same puzzle — the hook a future "daily puzzle" feature needs. Omit `seed` for a random puzzle
   each call.

### Region colours

`components/palette.js` holds a curated, food-themed colour list, but region *shape* is random — index-order
assignment could put two similar warm tones right next to each other. `components/colorMath.js` converts
each colour to CIE Lab and `components/regionColorAssignment.js` uses that to actually pick which region
gets which palette colour: it builds the on-screen adjacency graph between regions (including diagonal
neighbours, since corner-touching regions read as "next to each other" too) and greedily assigns colours so
that touching regions end up as perceptually distant as the palette allows. `palette.js` also picks a
contrast-safe icon colour (white or dark ink) per region so the chilli/✕ glyph stays legible on both bright
and dark backgrounds.

### Hints

`game/hints.js` is a small deduction engine, not an answer-revealer — `getHint` runs a handful of rules a
human player would actually reason through, in order from easiest to spot to hardest, and stops at the
first one that applies:

1. **Conflict** — a placed chilli rules out the rest of its row/column/region and the cells touching it.
2. **Locked candidates** — a region's remaining candidates all sit in one row or column, so that row/column's
   chilli has to come from this region, ruling out everything else in it.
3. **Naked single** — a row, column, or region is down to exactly one candidate cell, so it must hold the
   chilli.
4. **Forced** — none of the named patterns above apply yet (uncommon, and mostly early on). Falls through to
   `solveByPropagation`'s assume-the-opposite-and-check reasoning to find one cell whose status is provably
   forced from the *current* board state — no peeking at the precomputed solution anywhere in this file.
   Since every generated puzzle is already verified fully solvable this way before it's ever shown to a
   player, this tier is guaranteed to find something whenever the named patterns don't.

`describeHint` turns whichever rule fired into a plain-English explanation; the UI highlights the affected
cell(s) rather than applying the hint automatically, so the player still makes the move themselves.

**On "no guessing needed":** this is an actual, verified guarantee, not just a hope — `generatePuzzle` never
returns a board that `solveByPropagation` can't fully resolve, and `getHint` is built on that same honest
reasoning (not the puzzle's precomputed answer), so a player who only ever takes forced moves — with or
without clicking Hint — can always reach the solution. `src/game/__tests__/solver.test.js` covers this
directly, including a negative case (a deliberately ambiguous board) confirming the checker correctly
reports "not solvable without guessing" rather than papering over real ambiguity.

### Tuning difficulty / look

- **Board size**: `generatePuzzle({ size })` — the UI currently hardcodes `BOARD_SIZE = 8` in `src/App.jsx`.
  Sizes 4–8 generate in single-digit milliseconds. The no-guessing check (`solveByPropagation`) adds real
  cost as size grows — 9 averages ~50ms and 10 averages several hundred ms in testing — so sizes above 8
  aren't currently exposed in the UI; raising the default would want a loading state.
- **Region balance**: `growRegions`'s smallest-first rule is what keeps regions even; there's no separate
  tunable knob today, but a max-region-size cap could be reintroduced in `generateGrid.js` if you want to
  force even tighter balance (at some cost to generation speed/success rate).
- **Generation budget**: `MAX_OUTER_ATTEMPTS` and `MAX_REPAIR_STEPS` at the top of `generateGrid.js` bound
  how hard generation tries (uniqueness repair, then the no-guessing check) before giving up. Raise them if
  you push board size up and start seeing generation failures.

## Project structure

```
src/
  game/                  # framework-agnostic puzzle logic (no React/DOM)
    rng.js               # seeded PRNG
    generateGrid.js       # solution + region generation, uniqueness repair
    solver.js             # constraint solver (count / find solutions)
    validators.js         # adjacency, row/col/region conflict checks, win check
    hints.js               # deduction-rule hint engine
    __tests__/            # node:test suite for the above
  components/
    palette.js                  # region colour palette + contrast-safe icon colour
    colorMath.js                 # Lab conversion / distance, contrast ratio helpers
    regionColorAssignment.js     # assigns palette colours so touching regions stay distinct
    ChilliIcon.jsx
    Board.jsx / Cell.jsx
    Header.jsx / Timer.jsx
    HowToPlayModal.jsx / WinModal.jsx / HintPanel.jsx
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
