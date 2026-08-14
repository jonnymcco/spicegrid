export function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function Timer({ seconds }) {
  return (
    <div
      className="flex items-center gap-2 rounded-full border-2 border-riso-ink bg-white/80 px-4 py-1.5 font-display text-sm font-semibold tabular-nums text-riso-ink shadow-riso-sm dark:bg-riso-ink/60 dark:text-riso-paper"
      aria-live="off"
    >
      <span aria-hidden="true">⏱</span>
      <span>{formatTime(seconds)}</span>
    </div>
  );
}
