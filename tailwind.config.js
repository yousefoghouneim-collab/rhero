/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Barlow', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Noto Sans', 'Noto Sans Arabic', 'Noto Sans Devanagari', 'Noto Sans Bengali', 'Noto Sans Malayalam', 'sans-serif'],
      },
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        sunken: v('sunken'),
        line: v('line'),
        ink: v('ink'),
        muted: v('muted'),
        navy: { DEFAULT: '#202854', 50: '#eef0f8', 100: '#dde1f0', 200: '#b9c0de', 300: '#8f99c6', 400: '#5f6ca6', 500: '#3c4886', 600: '#2a346d', 700: '#202854', 800: '#181e44', 900: '#10142f' },
        brand: { red: '#af1615', redDeep: '#8c1211', redSoft: '#fbeaea', wing: '#b20709' },
        ok: { DEFAULT: '#15803d', soft: '#dcfce7', ink: '#166534' },
        warn: { DEFAULT: '#ea580c', soft: '#ffedd5', ink: '#9a3412' },
        bad: { DEFAULT: '#dc2626', soft: '#fee2e2', ink: '#991b1b' },
      },
      boxShadow: {
        card: '0 1px 2px rgb(16 20 47 / 0.06), 0 1px 1px rgb(16 20 47 / 0.04)',
        lift: '0 10px 30px -12px rgb(16 20 47 / 0.35)',
      },
      borderRadius: { xl2: '1.25rem' },
      keyframes: {
        pop: { '0%': { transform: 'scale(.6)' }, '60%': { transform: 'scale(1.15)' }, '100%': { transform: 'scale(1)' } },
        fadeup: { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'none' } },
        pulse2: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.35 } },
        sheet: { '0%': { transform: 'translateY(100%)' }, '100%': { transform: 'none' } },
      },
      animation: {
        pop: 'pop .28s ease-out',
        fadeup: 'fadeup .25s ease-out both',
        pulse2: 'pulse2 1.6s ease-in-out infinite',
        sheet: 'sheet .22s cubic-bezier(.2,.8,.2,1)',
      },
    },
  },
  plugins: [],
};
