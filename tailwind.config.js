export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#00e676", dark: "#00c853", light: "#69f0ae", dim: "#00e67620" },
        surface: { 0: "#060b18", 1: "#0b1121", 2: "#111827", 3: "#1a2235", 4: "#243049" },
        muted: "#64748b",
      },
      fontFamily: { display: ['"Outfit"', "sans-serif"], body: ['"DM Sans"', "sans-serif"] },
    },
  },
  plugins: [],
};
