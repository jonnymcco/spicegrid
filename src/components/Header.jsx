import ChilliIcon from "./ChilliIcon.jsx";

function IconButton({ onClick, label, children, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={[
        "flex h-9 w-9 items-center justify-center rounded-full border-2 border-riso-ink text-base shadow-riso-sm transition-transform hover:-translate-y-0.5 active:translate-y-0",
        active ? "bg-riso-purple text-white" : "bg-white/80 text-riso-ink dark:bg-riso-ink/60 dark:text-riso-paper",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function Header({
  isDark,
  onToggleDark,
  mistakesEnabled,
  onToggleMistakes,
  onHowToPlay,
  onReset,
  onNewPuzzle,
}) {
  return (
    <header className="riso-halftone relative w-full overflow-hidden border-b-[3px] border-riso-ink bg-riso-purple">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="riso-offset-title flex items-center gap-2">
            <ChilliIcon className="h-8 w-8 text-riso-pink drop-shadow-[2px_2px_0_rgba(0,0,0,0.35)] sm:h-9 sm:w-9" title="" />
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Spice Grid
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <IconButton onClick={onHowToPlay} label="How to play">?</IconButton>
            <IconButton onClick={onToggleMistakes} label="Toggle mistake counter" active={mistakesEnabled}>
              ✕
            </IconButton>
            <IconButton onClick={onToggleDark} label="Toggle light / dark mode">
              {isDark ? "☀" : "☾"}
            </IconButton>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onNewPuzzle}
            className="rounded-full border-2 border-riso-ink bg-riso-pink px-4 py-1.5 font-display text-sm font-bold text-white shadow-riso-sm transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            New puzzle
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded-full border-2 border-riso-ink bg-white/90 px-4 py-1.5 font-display text-sm font-bold text-riso-ink shadow-riso-sm transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            Reset puzzle
          </button>
        </div>
      </div>
    </header>
  );
}
