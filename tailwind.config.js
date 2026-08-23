/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* Nigerian flag green — brand primary */
        brand: {
          50: '#EAF8F1',
          100: '#CDEFDF',
          200: '#9CDFBF',
          300: '#63C99C',
          400: '#2FAE7B',
          500: '#008751',
          600: '#007546',
          700: '#005F39',
          800: '#00492C',
          900: '#00351F',
          950: '#001F12',
        },
        /* Coat-of-arms eagle red — destructive / high priority */
        crest: {
          50: '#FDF0EE',
          100: '#FADCD8',
          200: '#F4B5AD',
          300: '#EC8579',
          400: '#E2584A',
          500: '#CE1126',
          600: '#B00E20',
          700: '#8E0B1A',
          800: '#6C0814',
          900: '#4F060F',
        },
        /* Warning / SLA at-risk */
        gold: {
          50: '#FFF9E8',
          100: '#FDEFC3',
          200: '#FADE8A',
          300: '#F5C74C',
          400: '#EDAF1E',
          500: '#D4930A',
          600: '#AB7207',
          700: '#82550A',
          800: '#5E3D0B',
          900: '#432C09',
        },
        ink: {
          50: '#F7F9F8',
          100: '#EEF2F0',
          200: '#DDE4E1',
          300: '#C2CEC9',
          400: '#93A5A0',
          500: '#677974',
          600: '#4C5C58',
          700: '#3A4744',
          800: '#25302D',
          900: '#151D1B',
          950: '#0A0F0E',
        },
      },
      spacing: {
        '4.5': '1.125rem',
        '5.5': '1.375rem',
        '9.5': '2.375rem',
        '13': '3.25rem',
        '18': '4.5rem',
        '68': '17rem',
        '72': '18rem',
      },
      fontFamily: {
        sans: ['"Inter var"', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(21 29 27 / 0.04), 0 1px 3px 0 rgb(21 29 27 / 0.06)',
        raised: '0 2px 4px -1px rgb(21 29 27 / 0.06), 0 8px 20px -6px rgb(21 29 27 / 0.12)',
        overlay: '0 10px 15px -3px rgb(21 29 27 / 0.10), 0 24px 48px -12px rgb(21 29 27 / 0.22)',
        'focus-brand': '0 0 0 3px rgb(0 135 81 / 0.25)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'slide-up': 'slide-up 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slide-in-right 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-left': 'slide-in-left 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scale-in 140ms cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer: 'shimmer 1.6s infinite',
      },
      gridTemplateColumns: {
        shell: 'auto 1fr',
      },
    },
  },
  plugins: [],
}
