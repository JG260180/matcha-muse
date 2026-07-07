/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#F7F4ED',
        ink: '#22392B',
        matcha: { DEFAULT: '#7BA05B', deep: '#40573B', mist: '#DCE5D4' },
        sand: { DEFAULT: '#EAE3D3', ink: '#5A5142' },
      },
      fontFamily: {
        display: ['"Iowan Old Style"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
