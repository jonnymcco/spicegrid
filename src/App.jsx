import { useEffect, useMemo, useState } from "react";
import { generatePuzzle } from "./game/generateGrid.js";
import {
  CELL_SHAMROCK,
  CELL_EMPTY,
  CELL_X,
  createEmptyCellStates,
  findConflicts,
  isSolved,
} from "./game/validators.js";
import { getRegionPalette } from "./components/palette.js";
import { assignRegionColors } from "./components/regionColorAssignment.js";
import { getHint, describeHint, hasValidCompletion } from "./game/hints.js";
import Header from "./components/Header.jsx";
import Board from "./components/Board.jsx";
import Timer from "./components/Timer.jsx";
import HowToPlayModal from "./components/HowToPlayModal.jsx";
import WinModal from "./components/WinModal.jsx";
import HintPanel from "./components/HintPanel.jsx";
import DeadEndBanner from "./components/DeadEndBanner.jsx";
import Footer from "./components/Footer.jsx";

const BOARD_SIZE = 8;
const SEEN_TUTORIAL_KEY = "lucky-patch:seen-how-to-play";
const DARK_MODE_KEY = "lucky-patch:dark-mode";
// Deep enough that undo never runs out mid-puzzle; bounded so a very long
// session can't grow the stack without limit.
const MAX_HISTORY = 200;

function cycleCellState(state) {
  if (state === CELL_EMPTY) return CELL_X;
  if (state === CELL_X) return CELL_SHAMROCK;
  return CELL_EMPTY;
}

function randomSeed() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Generation is randomised and occasionally (rarely, at N=8) fails to find a
// uniquely-solvable, reasonably-balanced layout within its attempt budget.
// Retrying with a fresh seed resolves it in practice.
function generatePuzzleWithRetries(size, maxRetries = 5) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return generatePuzzle({ size, seed: randomSeed() });
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

function getInitialDarkMode() {
  const stored = localStorage.getItem(DARK_MODE_KEY);
  if (stored !== null) return stored === "true";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export default function App() {
  const [puzzle, setPuzzle] = useState(() => generatePuzzleWithRetries(BOARD_SIZE));
  const [cellStates, setCellStates] = useState(() => createEmptyCellStates(BOARD_SIZE));
  const [mistakesEnabled, setMistakesEnabled] = useState(true);
  const [mistakeCount, setMistakeCount] = useState(0);

  const [hasStarted, setHasStarted] = useState(false);
  const [running, setRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [finalSeconds, setFinalSeconds] = useState(0);

  const [howToOpen, setHowToOpen] = useState(() => !localStorage.getItem(SEEN_TUTORIAL_KEY));
  const [winOpen, setWinOpen] = useState(false);
  const [isDark, setIsDark] = useState(getInitialDarkMode);
  const [hint, setHint] = useState(null);
  // Each entry is the board as it was *before* one player action. A swipe
  // marks many cells but is a single action, so it contributes one entry —
  // undoing a stroke shouldn't take eight presses.
  const [history, setHistory] = useState([]);

  const regionColors = useMemo(
    () => assignRegionColors(puzzle.regions, puzzle.size, getRegionPalette(puzzle.size)),
    [puzzle]
  );
  const regionNames = useMemo(() => regionColors.map((c) => c.name), [regionColors]);
  const conflicts = useMemo(() => findConflicts(cellStates, puzzle.regions), [cellStates, puzzle]);
  const solved = useMemo(() => isSolved(cellStates, puzzle.regions), [cellStates, puzzle]);
  // A hint that says "this cell of yours is wrong" needs a different look
  // from one saying "act on this cell" — otherwise the player reads the
  // highlight as an instruction and doubles down on the bad move.
  const hintFlagsMistake = hint?.reason === "wrong-placement" || hint?.reason === "wrong-mark";
  const hintedCells = useMemo(() => {
    if (!hint || hintFlagsMistake) return undefined;
    return new Set(hint.cells.map(([r, c]) => `${r},${c}`));
  }, [hint, hintFlagsMistake]);
  const blamedCells = useMemo(() => {
    if (!hint || !hintFlagsMistake) return undefined;
    return new Set(hint.cells.map(([r, c]) => `${r},${c}`));
  }, [hint, hintFlagsMistake]);
  const hintMessage = useMemo(() => (hint ? describeHint(hint, regionNames) : ""), [hint, regionNames]);

  // Placing a shamrock that breaks no rule can still make the puzzle
  // impossible to finish. That used to pass completely unnoticed — the
  // mistake counter only ever caught immediate rule violations — so a
  // player could keep working a dead board for minutes. Check it directly.
  const deadEnd = useMemo(
    () => !solved && !hasValidCompletion(cellStates, puzzle.regions, puzzle.size),
    [cellStates, puzzle, solved]
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem(DARK_MODE_KEY, String(isDark));
  }, [isDark]);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (solved && !winOpen) {
      setRunning(false);
      setFinalSeconds(elapsedSeconds);
      setWinOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved]);

  const startNewPuzzle = () => {
    setPuzzle(generatePuzzleWithRetries(BOARD_SIZE));
    resetProgress();
  };

  const resetProgress = () => {
    setCellStates(createEmptyCellStates(BOARD_SIZE));
    setMistakeCount(0);
    setHasStarted(false);
    setRunning(false);
    setElapsedSeconds(0);
    setWinOpen(false);
    setHint(null);
    setHistory([]);
  };

  /** Records the board as it stands, so the action about to happen can be undone. */
  const recordUndoPoint = () => {
    setHistory((h) => [...h, { cellStates, mistakeCount }].slice(-MAX_HISTORY));
  };

  const handleUndo = () => {
    if (history.length === 0 || solved) return;
    const previous = history[history.length - 1];
    setCellStates(previous.cellStates);
    // The mistake count rewinds too — leaving a mistake on the board for a
    // move that no longer exists would be odd.
    setMistakeCount(previous.mistakeCount);
    setHistory(history.slice(0, -1));
    setHint(null);
    // The clock deliberately keeps running: undo takes back moves, not time.
  };

  const handleCellClick = (row, col) => {
    if (solved) return;

    const newState = cycleCellState(cellStates[row][col]);
    const next = cellStates.map((r, ri) => (ri === row ? r.map((v, ci) => (ci === col ? newState : v)) : r));

    if (newState === CELL_SHAMROCK && mistakesEnabled) {
      const conflictsAfter = findConflicts(next, puzzle.regions);
      if (conflictsAfter.has(`${row},${col}`)) {
        setMistakeCount((m) => m + 1);
      }
    }

    recordUndoPoint();
    setCellStates(next);
    setHint(null);
    if (!hasStarted) {
      setHasStarted(true);
      setRunning(true);
    }
  };

  const handleDragMarkCell = (row, col, isStrokeStart) => {
    if (solved) return;

    // One undo point per stroke, not per cell: a swipe across a row is a
    // single action from the player's point of view, so taking it back
    // should be a single press.
    if (isStrokeStart) recordUndoPoint();

    // Functional update, not a closure read of `cellStates`: pointermove
    // fires one drag-marked cell at a time in quick succession, and this
    // needs to build on the truly latest state each time rather than risk
    // several calls reading the same stale snapshot before React commits
    // the first one.
    setCellStates((prev) => {
      if (prev[row][col] !== CELL_EMPTY) return prev; // never overwrite a shamrock, and marking an already-X cell is a no-op
      return prev.map((r, ri) => (ri === row ? r.map((v, ci) => (ci === col ? CELL_X : v)) : r));
    });

    setHint(null);
    if (!hasStarted) {
      setHasStarted(true);
      setRunning(true);
    }
  };

  const handleGetHint = () => {
    if (solved) return;
    setHint(getHint(cellStates, puzzle.regions, puzzle.size));
    if (!hasStarted) {
      setHasStarted(true);
      setRunning(true);
    }
  };

  // Ctrl/Cmd+Z as well as the button — undo without the usual shortcut
  // feels broken on a desktop keyboard.
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const closeHowTo = () => {
    setHowToOpen(false);
    localStorage.setItem(SEEN_TUTORIAL_KEY, "true");
  };

  return (
    <div className="riso-grain flex min-h-screen flex-col bg-riso-paper dark:bg-riso-paper-dark">
      <Header
        isDark={isDark}
        onToggleDark={() => setIsDark((d) => !d)}
        mistakesEnabled={mistakesEnabled}
        onToggleMistakes={() => setMistakesEnabled((m) => !m)}
        onHowToPlay={() => setHowToOpen(true)}
        onReset={resetProgress}
        onNewPuzzle={startNewPuzzle}
        onHint={handleGetHint}
        hintDisabled={solved}
        onUndo={handleUndo}
        undoDisabled={history.length === 0 || solved}
      />

      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-5 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Timer seconds={elapsedSeconds} />
          {mistakesEnabled && (
            <div className="flex items-center gap-2 rounded-full border-2 border-riso-ink bg-white/80 px-4 py-1.5 font-display text-sm font-semibold text-riso-ink shadow-riso-sm dark:bg-riso-ink/60 dark:text-riso-paper">
              <span aria-hidden="true">✕</span>
              <span>
                {mistakeCount} mistake{mistakeCount === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </div>

        <DeadEndBanner open={deadEnd && !hintFlagsMistake} onHint={handleGetHint} />

        <HintPanel hint={hint} message={hintMessage} onDismiss={() => setHint(null)} />

        <Board
          puzzle={puzzle}
          cellStates={cellStates}
          conflicts={conflicts}
          regionColors={regionColors}
          regionNames={regionNames}
          hintedCells={hintedCells}
          blamedCells={blamedCells}
          onCellClick={handleCellClick}
          onDragMarkCell={handleDragMarkCell}
        />

        <p className="max-w-md text-center text-xs text-riso-ink/60 dark:text-riso-paper/60">
          One shamrock per row, column &amp; colour. Nothing touches — not even diagonally.
        </p>
      </main>

      <Footer />

      <HowToPlayModal open={howToOpen} onClose={closeHowTo} />
      <WinModal
        open={winOpen}
        seconds={finalSeconds}
        mistakeCount={mistakeCount}
        mistakesEnabled={mistakesEnabled}
        onNewPuzzle={startNewPuzzle}
        onClose={() => setWinOpen(false)}
      />
    </div>
  );
}
