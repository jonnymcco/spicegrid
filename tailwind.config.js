/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Riso-inspired brand palette: electric pink + funky purple.
        riso: {
          pink: "#FF3EA5",
          "pink-dark": "#D6117E",
          purple: "#6F2DBD",
          "purple-dark": "#4C1D8C",
          ink: "#1B1023",
          paper: "#FFF6EC",
          "paper-dark": "#241629",
        },
        chilli: {
          error: "#E5233D",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "'Segoe UI'", "sans-serif"],
        body: ["'Inter'", "'Segoe UI'", "sans-serif"],
      },
      boxShadow: {
        riso: "6px 6px 0 0 rgba(111,45,189,0.9)",
        "riso-sm": "3px 3px 0 0 rgba(111,45,189,0.9)",
        "riso-pink": "6px 6px 0 0 rgba(255,62,165,0.85)",
      },
      keyframes: {
        pop: {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "70%": { transform: "scale(1.12)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-4px)" },
          "40%": { transform: "translateX(4px)" },
          "60%": { transform: "translateX(-3px)" },
          "80%": { transform: "translateX(3px)" },
        },
        "flash-error": {
          "0%, 100%": { backgroundColor: "rgba(229,35,61,0)" },
          "50%": { backgroundColor: "rgba(229,35,61,0.55)" },
        },
        "win-pop": {
          "0%": { transform: "scale(0.85)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        confetti: {
          "0%": { transform: "translateY(0) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translateY(220px) rotate(540deg)", opacity: "0" },
        },
      },
      animation: {
        pop: "pop 220ms cubic-bezier(0.34,1.56,0.64,1)",
        shake: "shake 380ms ease-in-out",
        "flash-error": "flash-error 650ms ease-in-out 2",
        "win-pop": "win-pop 320ms cubic-bezier(0.34,1.56,0.64,1)",
        confetti: "confetti 1100ms ease-in forwards",
      },
    },
  },
  plugins: [],
};
