import { formatTime } from "./Timer.jsx";
import ShamrockIcon from "./ShamrockIcon.jsx";

const CONFETTI_COLORS = ["#FF3EA5", "#6F2DBD", "#F2A541", "#8FAF3D", "#E8791A"];

function Confetti() {
  const pieces = Array.from({ length: 18 });
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center overflow-hidden">
      {pieces.map((_, i) => (
        <span
          key={i}
          className="absolute top-0 block h-2.5 w-2.5 animate-confetti rounded-sm"
          style={{
            left: `${(i * 97) % 100}%`,
            backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${(i % 6) * 60}ms`,
          }}
        />
      ))}
    </div>
  );
}

export default function WinModal({ open, seconds, mistakeCount, mistakesEnabled, onNewPuzzle, onClose }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-riso-ink/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="win-title"
    >
      <div className="relative w-full max-w-sm animate-win-pop overflow-hidden rounded-2xl border-[3px] border-riso-ink bg-riso-paper p-6 text-center shadow-riso dark:bg-riso-paper-dark">
        <Confetti />

        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full border-2 border-riso-ink bg-riso-pink shadow-riso-sm">
          <ShamrockIcon className="h-9 w-9 text-white" title="" />
        </div>

        <h2 id="win-title" className="font-display text-2xl font-extrabold text-riso-purple dark:text-riso-pink">
          Solved it! ☘️
        </h2>
        <p className="mt-1 font-display text-lg font-semibold text-riso-ink dark:text-riso-paper">
          Solved in {formatTime(seconds)}
        </p>
        {mistakesEnabled && (
          <p className="mt-1 text-sm text-riso-ink/70 dark:text-riso-paper/70">
            {mistakeCount === 0 ? "Flawless — zero mistakes!" : `${mistakeCount} mistake${mistakeCount === 1 ? "" : "s"} along the way`}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={onNewPuzzle}
            className="w-full rounded-full border-2 border-riso-ink bg-riso-pink px-4 py-2 font-display font-bold text-white shadow-riso-sm transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            New puzzle
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full border-2 border-riso-ink bg-transparent px-4 py-2 font-display font-semibold text-riso-ink transition-colors hover:bg-riso-ink/5 dark:text-riso-paper dark:hover:bg-white/10"
          >
            Keep admiring the grid
          </button>
        </div>
      </div>
    </div>
  );
}
