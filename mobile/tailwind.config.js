const { hairlineWidth } = require('nativewind/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#10214F',
        accent: '#01BBDC',
        'accent-dark': '#0199B8',
        background: '#F8F9FC',
        surface: '#FFFFFF',
        border: '#DBDBDB',
        muted: '#6B7280',
        danger: '#EF4444',
        success: '#22C55E',
        warning: '#F59E0B',
      },
      fontFamily: {
        sans: ['Poppins_400Regular', 'sans-serif'],
        'sans-medium': ['Poppins_500Medium', 'sans-serif'],
        'sans-semibold': ['Poppins_600SemiBold', 'sans-serif'],
        'sans-bold': ['Poppins_700Bold', 'sans-serif'],
        display: ['Bahnschrift', 'DIN Alternate', 'sans-serif'],
      },
      borderWidth: {
        hairline: hairlineWidth(),
      },
    },
  },
  plugins: [],
};
