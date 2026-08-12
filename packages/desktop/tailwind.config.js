/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#150A5E", // Indigo de la charte v2
        paper: "#FAF9F5",
        "paper-dark": "#F0EEEA",
        slate: "#5B6B82",
        "fanion-green": "#1E7A4C",
        "fanion-gold": "#C99A3B",
        "signal-red": "#B3432E",
        line: "#E4E0D6",
      },
      fontFamily: {
        display: ["'Source Serif 4'", "serif"],
        sans: ["Inter", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        DEFAULT: "4px",
      },
    },
  },
  plugins: [],
};
