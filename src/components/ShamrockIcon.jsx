export default function ShamrockIcon({ className = "", style, title = "Shamrock" }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      style={style}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M32 40v13" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <circle cx="32" cy="16" r="12.5" fill="currentColor" />
      <circle cx="43" cy="34" r="12.5" fill="currentColor" />
      <circle cx="21" cy="34" r="12.5" fill="currentColor" />
    </svg>
  );
}
