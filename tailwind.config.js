/** @type {import('tailwindcss').Config} */
export default {
  content: ["./frontend/**/*.{html,js}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#1c74e9",
        "background-light": "#f6f7f8",
        "background-dark": "#111821",
      },
      fontFamily: {
        "display": ["Lexend"]
      },
      borderRadius: { "DEFAULT": "0.25rem", "lg": "0.5rem", "xl": "0.75rem", "full": "9999px" },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
