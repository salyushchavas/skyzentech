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
        // Skyzen Technologies palette — sourced from the legacy index.html CSS variables.
        skyzen: {
          dark:   '#080d1a',  // --dark    primary page bg
          dark2:  '#0c1221',  // --dark2   alternate section bg
          dark3:  '#111827',  // --dark3   tertiary section bg
          navy:   '#0f2238',  // --navy    accent dark
          light:  '#f8fafc',  // --light   light section bg
          text:   '#e2e8f0',  // --text    body text on dark
          muted:  '#8a9ab5',  // --muted   secondary text
          border: 'rgba(255,255,255,0.08)',
          card:   'rgba(255,255,255,0.04)',
        },
        // Brand accent — orange family from legacy site
        accent: {
          DEFAULT: '#fb9b47',  // --orange
          dark:    '#ff7c20',  // --orange2 (used for gradient end)
          light:   '#ffb347',  // gradient highlight tone
        },
        // Re-export `primary` so existing pages that still use `primary-*` don't break.
        // Mapped onto the orange brand accent.
        primary: {
          50:  '#fff5ec',
          100: '#ffe6d1',
          200: '#ffcc9e',
          300: '#ffb066',
          400: '#fb9b47',
          500: '#ff7c20',
          600: '#e0862f',
          700: '#b86723',
          800: '#8f4f1c',
          900: '#5e3411',
        },
      },
      fontFamily: {
        // Poppins is loaded via next/font in app/layout.tsx and exposed as --font-poppins.
        sans: ['var(--font-poppins)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        poppins: ['var(--font-poppins)', 'sans-serif'],
      },
      boxShadow: {
        'glow-accent': '0 6px 24px rgba(251,155,71,0.4)',
        'glow-accent-lg': '0 10px 30px rgba(251,155,71,0.55)',
      },
    },
  },
  plugins: [],
};

export default config;
