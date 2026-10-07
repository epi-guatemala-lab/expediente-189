/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        igss: {
          // Verdes del logo (árbol, hojas, vestido)
          900: '#0A3D0C',
          800: '#1B5E20',
          700: '#2E7D32',
          600: '#388E3C',
          500: '#43A047',
          400: '#66BB6A',
          300: '#A5D6A7',
          200: '#C8E6C9',
          100: '#E8F5E9',
          50:  '#F1F8F1',
          // Rojo del logo (letras IGSS)
          red: '#C41E24',
          'red-dark': '#8E1519',
          'red-light': '#EF5350',
          // Dorado del banner
          gold: '#BFA033',
          'gold-dark': '#8B7424',
          'gold-light': '#D4B94E',
          'gold-50': '#FDF8E8',
          // Café del tronco
          brown: '#5D4037',
          'brown-light': '#795548',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'igss': '0 4px 20px rgba(27, 94, 32, 0.15)',
        'igss-lg': '0 8px 30px rgba(27, 94, 32, 0.2)',
      },
    },
  },
  plugins: [],
}
