export default {
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Kept in sync with the @theme block in app/globals.css, which is the
      // actual source of truth for these tokens under Tailwind v4.
      colors: {
        primary: '#01BCDD',
        secondary: '#10214F',
        navy: '#10214F',
        soft: '#F5F7FA',
        accent: '#CCAF8B',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};