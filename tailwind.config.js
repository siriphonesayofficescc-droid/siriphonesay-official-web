/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0A0A0B',
        coal: '#111113',
        graphite: '#1A1B1E',
        steel: { DEFAULT: '#8B9099', light: '#B9BDC4', dark: '#4A4E55' },
        mist: '#ECEAE5',
        gold: { DEFAULT: '#C9A96E', light: '#E4D2A6', dark: '#8E7444' },
      },
      fontFamily: {
        display: ['"Archivo Variable"', 'Archivo', 'system-ui', 'sans-serif'],
        sans: ['"Inter Variable"', 'Inter', '"Noto Sans Lao"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        lao: ['"Noto Sans Lao"', 'sans-serif'],
      },
      letterSpacing: { widest2: '0.32em' },
      maxWidth: { site: '1320px' },
    },
  },
  plugins: [],
}
