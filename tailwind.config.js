/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "app/**/*.{ts,tsx}",
    "components/**/*.{ts,tsx}",
    "src/**/*.{ts,tsx}",
  ],
  theme: {},
  plugins: [require("tailwindcss-animate")],
};
