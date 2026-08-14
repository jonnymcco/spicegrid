export default function ChilliIcon({ className = "", style, title = "Chilli" }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      style={style}
      role="img"
      aria-label={title}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M27 13c2-4 6-7 10-8 1.4-0.3 2.3 1.2 1.4 2.3-1.6 1.9-3 4.1-3.6 6.1 1.2-.4 2.6-.2 3.4.9 1 1.4.2 3-1.2 3.6"
        stroke="#3F7A3E"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M24 17c9.5-1.8 21.5 4.3 22.8 15.7 1.3 11.6-9.6 25.8-21.3 27.6C14.8 62 6 54 6.5 43.4 7 32.8 14.4 18.8 24 17Z"
        fill="currentColor"
      />
      <path
        d="M22 22c4-1.4 8.6-1 8.6-1"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
