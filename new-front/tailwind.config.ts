import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          950: '#020617'
        }
      },
      fontFamily: {
        inter: ['var(--font-inter)', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        glow: '0 10px 40px rgba(99,102,241,0.25)'
      }
    }
  },
  plugins: []
};

export default config;
