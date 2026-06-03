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
        // ── Legacy Skyzen marketing palette (kept for /home + chrome) ────────
        skyzen: {
          dark:   '#080d1a',
          dark2:  '#0c1221',
          dark3:  '#111827',
          navy:   '#0f2238',
          light:  '#f8fafc',
          text:   '#e2e8f0',
          muted:  '#8a9ab5',
          border: 'rgba(255,255,255,0.08)',
          card:   'rgba(255,255,255,0.04)',
        },
        // Legacy orange accent — marketing site only. The dashboard chrome
        // moved to teal as its brand (see `brand` below).
        accent: {
          DEFAULT: '#fb9b47',
          dark:    '#ff7c20',
          light:   '#ffb347',
        },
        // `primary` left in place so legacy pages with primary-* classes keep
        // rendering. New code uses `brand-*` for the dashboard chrome.
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
        // ── Design system (dashboard) — teal brand + slate chrome ─────────
        brand: {
          50:  '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
      },
      fontFamily: {
        // Poppins kept for marketing chrome; Inter is the dashboard typeface.
        // `font-sans` resolves to Inter first, falls back to Poppins, then
        // system sans — dashboard surfaces opt-in by class, marketing pages
        // keep working because Poppins is still in the cascade.
        sans: [
          'var(--font-inter)',
          'var(--font-poppins)',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
        poppins: ['var(--font-poppins)', 'sans-serif'],
        inter: ['var(--font-inter)', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'glow-accent': '0 6px 24px rgba(251,155,71,0.4)',
        'glow-accent-lg': '0 10px 30px rgba(251,155,71,0.55)',
        // Dashboard surface elevation — quiet, not glowy.
        'ds-sm': '0 1px 2px rgba(15,23,42,0.06)',
        'ds-md': '0 4px 10px rgba(15,23,42,0.08)',
        'ds-lg': '0 12px 24px rgba(15,23,42,0.10)',
      },
      ringColor: {
        DEFAULT: '#14b8a6',
      },
      keyframes: {
        'modal-in': {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'modal-out': {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0.98)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'modal-in': 'modal-in 200ms ease-out',
        'modal-out': 'modal-out 150ms ease-out',
        'fade-in': 'fade-in 150ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
