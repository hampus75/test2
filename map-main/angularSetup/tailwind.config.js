/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#0066cc',
        'primary-dark': '#004c99',
        'secondary': '#4CAF50',
        'secondary-dark': '#45a049',
      },
    },
  },
  plugins: [],
}
