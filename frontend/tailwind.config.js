/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#fbf8f3",
        lavender: { 50: "#f6f3fd", 100: "#ece6fb", 200: "#d9cef5", 300: "#bfaeea", 400: "#a08dd9" },
        dusty: { 100: "#e4ecf6", 200: "#c7d6ea", 300: "#9fb7d6", 400: "#7895bf" },
        blush: { 100: "#fbe8ee", 200: "#f5cfdb", 300: "#eaa9be" },
        mint: { 100: "#e3f5ee", 200: "#c4eadb", 300: "#94d5bc" },
        violet: { 500: "#7a68b8", 600: "#5f4f9c" },
        navy: { 500: "#4a5378", 700: "#2d3354", 900: "#1d2140" },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        display: ['"Space Grotesk"', '"Plus Jakarta Sans"', "sans-serif"],
      },
      boxShadow: { glass: "0 8px 32px -12px rgba(77, 72, 140, 0.18)" },
      keyframes: {
        orbit: { to: { transform: "rotate(360deg)" } },
        twinkle: { "0%,100%": { opacity: 0.25 }, "50%": { opacity: 0.9 } },
        rise: { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "none" } },
      },
      animation: {
        orbit: "orbit 18s linear infinite",
        "orbit-fast": "orbit 1.6s linear infinite",
        twinkle: "twinkle 4s ease-in-out infinite",
        rise: "rise .5s ease-out both",
      },
    },
  },
  plugins: [],
};
