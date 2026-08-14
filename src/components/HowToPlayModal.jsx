import ChilliIcon from "./ChilliIcon.jsx";

export default function HowToPlayModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-riso-ink/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-to-play-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md animate-win-pop rounded-2xl border-[3px] border-riso-ink bg-riso-paper p-6 shadow-riso dark:bg-riso-paper-dark"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-2xl font-display leading-none text-riso-ink/60 hover:text-riso-pink dark:text-riso-paper/60"
        >
          &times;
        </button>

        <h2
          id="how-to-play-title"
          className="mb-4 flex items-center gap-2 font-display text-2xl font-bold text-riso-purple dark:text-riso-pink"
        >
          <ChilliIcon className="h-7 w-7 text-riso-pink" title="" />
          How to play Spice Grid
        </h2>

        <ul className="space-y-3 text-sm leading-relaxed text-riso-ink/90 dark:text-riso-paper/90">
          <li>
            <strong className="text-riso-purple dark:text-riso-pink">🌶️ One chilli per row, column &amp; region.</strong>{" "}
            Every coloured region, row, and column must contain exactly one chilli.
          </li>
          <li>
            <strong className="text-riso-purple dark:text-riso-pink">🚫 No touching.</strong> Two chillies can never be
            adjacent — not even diagonally.
          </li>
          <li>
            <strong className="text-riso-purple dark:text-riso-pink">👆 Tap to cycle.</strong> Tap a cell once for an{" "}
            <span className="font-semibold">✕</span> (a scratch mark to rule a cell out), tap again for a{" "}
            <span className="font-semibold">chilli</span>, tap once more to clear it.
          </li>
          <li>
            <strong className="text-riso-purple dark:text-riso-pink">✍️ Swipe to mark a run of cells.</strong> Press and
            drag across a row, column, or region to mark every cell you cross with an ✕ in one stroke —
            handy for ruling out a whole line at once. It won't touch cells that already have a chilli.
          </li>
          <li>
            <strong className="text-riso-purple dark:text-riso-pink">✅ Self-check.</strong> Placing a chilli highlights
            its row, column, and region. Two chillies that break a rule flash red.
          </li>
          <li>
            <strong className="text-riso-purple dark:text-riso-pink">🏆 Win</strong> by placing all N chillies with no
            rules broken.
          </li>
        </ul>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-full border-2 border-riso-ink bg-riso-pink px-4 py-2 font-display font-bold text-white shadow-riso-sm transition-transform hover:-translate-y-0.5 active:translate-y-0"
        >
          Let's cook 🔥
        </button>
      </div>
    </div>
  );
}
