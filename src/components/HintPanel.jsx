const ACTION_LABELS = {
  place: "Place a shamrock",
  eliminate: "Mark with ✕",
  remove: "Take this one back",
  unmark: "Clear this ✕",
};

export default function HintPanel({ hint, message, onDismiss }) {
  if (!hint) return null;

  const actionLabel = ACTION_LABELS[hint.type] ?? "Have a look here";
  // A hint pointing out the player's own mistake gets the warning palette,
  // so it doesn't read as "do this next".
  const isCorrection = hint.type === "remove" || hint.type === "unmark";

  return (
    <div
      role="status"
      className={[
        "flex w-full max-w-xl items-start gap-3 rounded-2xl border-2 px-4 py-3 text-left shadow-riso-sm",
        isCorrection
          ? "border-rose-500 bg-rose-50 dark:border-rose-400 dark:bg-rose-950/40"
          : "border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-950/40",
      ].join(" ")}
    >
      <span className="mt-0.5 text-lg" aria-hidden="true">
        {isCorrection ? "⚠️" : "💡"}
      </span>
      <div className="flex-1">
        <p
          className={[
            "font-display text-xs font-bold uppercase tracking-wide",
            isCorrection ? "text-rose-700 dark:text-rose-300" : "text-amber-700 dark:text-amber-400",
          ].join(" ")}
        >
          {actionLabel}
        </p>
        <p className="mt-0.5 text-sm leading-snug text-riso-ink dark:text-riso-paper">{message}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss hint"
        className={[
          "text-lg font-display leading-none",
          isCorrection
            ? "text-rose-700/60 hover:text-rose-700 dark:text-rose-300/70 dark:hover:text-rose-200"
            : "text-amber-700/60 hover:text-amber-700 dark:text-amber-400/70 dark:hover:text-amber-300",
        ].join(" ")}
      >
        &times;
      </button>
    </div>
  );
}
