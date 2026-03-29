/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["IBM Plex Sans", "Noto Sans SC", "sans-serif"],
        heading: ["Space Grotesk", "Noto Sans SC", "sans-serif"],
        "heading-cn": ["Source Han Serif SC", "Noto Serif SC", "Songti SC", "STSong", "serif"]
      },
      boxShadow: {
        glow: "0 24px 80px rgba(13, 33, 52, 0.45)"
      }
    }
  },
  plugins: []
};
