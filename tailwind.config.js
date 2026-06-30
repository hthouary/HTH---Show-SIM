/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ShowForge dark theme palette
        ink: {
          950: '#06070c',
          900: '#0a0c14',
          850: '#0e1018',
          800: '#13161f',
          750: '#181b26',
          700: '#1e222e',
          650: '#262b39',
          600: '#2f3545',
          500: '#3b4255',
        },
        accent: {
          cyan: '#22d3ee',
          blue: '#3b82f6',
          violet: '#8b5cf6',
          magenta: '#e64bd6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(34,211,238,0.4), 0 0 18px -2px rgba(34,211,238,0.45)',
        panel: '0 8px 30px -10px rgba(0,0,0,0.7)',
      },
      keyframes: {
        'pulse-fast': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
      animation: {
        'pulse-fast': 'pulse-fast 0.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
