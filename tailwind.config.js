/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // Esta é a linha que faltava
  content: [
    "./public/**/*.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
