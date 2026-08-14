export default function HintPanel({ hint, message, onDismiss }) {
  if (!hint) return null;

  const actionLabel = hint.type === "place" ? "Place a shamrock" : "Mark with ✕";

  return (
    <div
      role="status"
      className="flex w-full max-w-xl items-start gap-3 rounded-2xl border-2 border-amber-500 bg-amber-50 px-4 py-3 text-left shadow-riso-sm dark:border-amber-400 dark:bg-amber-950/40"
    >
      <span className="mt-0.5 text-lg" aria-hidden="true">
        💡
      </span>
      <div className="flex-1">
        <p className="font-display text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
          {actionLabel}
        </p>
        <p className="mt-0.5 text-sm leading-snug text-riso-ink dark:text-riso-paper">{message}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss hint"
        className="text-lg font-display leading-none text-amber-700/60 hover:text-amber-700 dark:text-amber-400/70 dark:hover:text-amber-300"
      >
        &times;
      </button>
    </div>
  );
}
