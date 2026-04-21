/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.tsx",
    "./components/**/*.tsx",
    "./services/**/*.ts",
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('tailwindcss-animate'),
    require('tailwind-scrollbar'),
  ],
}
