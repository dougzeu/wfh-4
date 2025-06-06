/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.html", "./js/**/*.{js,ts}"],
  theme: {
    extend: {
      colors: {
        'accent': '#a7ee43',
        'accent-green': '#A7EE43',
        'black': '#080F17',
        'white': '#D6DDE6',
        'transparent-3': '#D6DDE6',
        'transparent-2': '#FFFFFF',
        'google-1': '#4285F4',
        'google-2': '#34A853',
        'google-3': '#FBBC05',
        'google-4': '#EB4335'
      },
      fontFamily: {
        'jakarta': ['Plus Jakarta Sans', 'sans-serif']
      }
    },
  },
  plugins: [],
} 