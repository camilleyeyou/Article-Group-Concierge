import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['Lora', 'Georgia', 'serif'],
        mono: ['Space Mono', 'Courier New', 'monospace'],
        display: ['Lora', 'Georgia', 'serif'],
        body: ['Poppins', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        // Article Group Brand Colors
        'ag-black': '#1A1818',
        'ag-coral': '#F96A63',
        'ag-teal': '#0097A7',
        'ag-green': '#3FD9A3',
        'ag-blue': '#407CD1',
        'ag-purple': '#B47BD5',
        'ag-gray': {
          100: '#F3F3F3',
          200: '#EEEEEE',
          300: '#D4D4D4',
          400: '#8A8A8A',
          500: '#595959',
          600: '#333131',
          700: '#252323',
          800: '#1A1818',
        },
      },
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          sm: '2rem',
          lg: '4rem',
          xl: '5rem',
        },
        screens: {
          sm: '100%',
          md: '100%',
          lg: '1024px',
          xl: '1200px',
        },
      },
    },
  },
  plugins: [],
};

export default config;
