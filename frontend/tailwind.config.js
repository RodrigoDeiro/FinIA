/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Verde-FinIA (mesmo tom do logo/relatório)
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'Segoe UI', 'Roboto', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
