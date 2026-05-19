import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Placeholder brand palette — tuned to skyzentech.com in Phase 1.
        primary: {
          50:  '#eef6ff',
          100: '#d9eaff',
          200: '#bcd9ff',
          300: '#8ebfff',
          400: '#5a9bff',
          500: '#2f7bff',
          600: '#1a5eda',
          700: '#1849ad',
          800: '#193e89',
          900: '#16356b',
        },
      },
    },
  },
  plugins: [],
};

export default config;
