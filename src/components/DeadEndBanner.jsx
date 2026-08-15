export default function DeadEndBanner({ open, onHint }) {
  if (!open) return null;

  return (
    <div
      role="alert"
      className="flex w-full max-w-xl items-start gap-3 rounded-2xl border-2 border-rose-500 bg-rose-50 px-4 py-3 text-left shadow-riso-sm dark:border-rose-400 dark:bg-rose-950/40"
    >
      <span className="mt-0.5 text-lg" aria-hidden="true">
        ⚠️
      </span>
      <div className="flex-1">
        <p className="font-display text-xs font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">
          No way to finish from here
        </p>
        <p className="mt-0.5 text-sm leading-snug text-riso-ink dark:text-riso-paper">
          One of your shamrocks is in a spot the puzzle can't be completed around. It doesn't break a rule by
          itself, so nothing flagged it at the time.
        </p>
        <button
          type="button"
          onClick={onHint}
          className="mt-2 rounded-full border-2 border-riso-ink bg-white px-3 py-1 font-display text-xs font-bold text-riso-ink shadow-riso-sm transition-transform hover:-translate-y-0.5 active:translate-y-0 dark:bg-riso-ink dark:text-riso-paper"
        >
          Show me which one
        </button>
      </div>
    </div>
  );
}
