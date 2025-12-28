/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e8f4f8',
          100: '#b9dde8',
          200: '#8ac6d8',
          300: '#5bafc8',
          400: '#2c98b8',
          500: '#0d7fa0',
          600: '#0a6680',
          700: '#084c60',
          800: '#053340',
          900: '#031a20',
        },
        accent: {
          50: '#fff8e6',
          100: '#ffeab3',
          200: '#ffdc80',
          300: '#ffce4d',
          400: '#ffc01a',
          500: '#e6a600',
          600: '#b38100',
          700: '#805c00',
          800: '#4d3700',
          900: '#1a1200',
        },
        success: {
          500: '#10b981',
          600: '#059669',
        },
        warning: {
          500: '#f59e0b',
          600: '#d97706',
        },
        danger: {
          500: '#ef4444',
          600: '#dc2626',
        }
      },
      fontFamily: {
        sans: ['Cairo', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'card': '0 0 0 1px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.1)',
      }
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  }
}
