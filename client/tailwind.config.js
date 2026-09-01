/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        neu: {
          base: "#E0E5EC",
          light: "#E6E9EF",
          highlight: "#FFFFFF",
          shadow: "#A3B1C6",
          shadowDark: "#B8C6DB",
          text: "#2E3440",
          muted: "#6B7A90",
          primary: "#6C7BFF",
          success: "#4ECDC4",
          warning: "#FFB86C",
        },
      },
      boxShadow: {
        neu: "9px 9px 16px #A3B1C6, -9px -9px 16px #FFFFFF",
        "neu-sm": "5px 5px 10px #A3B1C6, -5px -5px 10px #FFFFFF",
        "neu-lg": "14px 14px 28px #A3B1C6, -14px -14px 28px #FFFFFF",
        "neu-inset": "inset 6px 6px 12px #A3B1C6, inset -6px -6px 12px #FFFFFF",
        "neu-inset-sm": "inset 4px 4px 8px #A3B1C6, inset -4px -4px 8px #FFFFFF",
        "neu-pressed": "inset 9px 9px 16px #A3B1C6, inset -9px -9px 16px #FFFFFF",
      },
      fontFamily: {
        sans: ["Nunito", "Quicksand", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        neu: "20px",
        "neu-lg": "24px",
      },
    },
  },
  plugins: [],
};
