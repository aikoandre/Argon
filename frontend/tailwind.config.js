/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        'app-bg': 'var(--color-background)',
        'app-surface': 'var(--color-surface)',
        'app-accent': 'var(--color-accent)',
        'app-accent-2': 'var(--color-accent-2)',
      },
      fontFamily: {
        'montserrat': ['Montserrat', 'sans-serif'],
        'quintessential': ['Quintessential', 'serif'],
      }
    },
  },
  plugins: [],
};
