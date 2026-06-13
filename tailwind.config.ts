import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Excellence Tracks Co. (ETC / مسارات الامتياز) brand palette
        brand: {
          orange: '#f47920',
          'orange-dark': '#c75e12',
          dark: '#1f2429',
          darker: '#14181c',
        },
      },
      fontFamily: {
        sans: ['var(--font-cairo)', 'Tahoma', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
