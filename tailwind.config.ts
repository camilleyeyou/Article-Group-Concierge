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
        // Article Group Brand Colors — synced with design-system.css
        'ag-black': '#1A1818',
        'ag-coral': '#fc5d4c',
        'ag-teal': '#47ddb2',
        'ag-green': '#47ddb2',
        'ag-blue': '#0d72d1',
        'ag-purple': '#b47bd5',
        'ag-gray': {
          100: '#F5F5F5',
          200: '#EEEEEE',
          300: '#D4D4D4',
          400: '#8A8A8A',
          500: '#6B6B6B',
          600: '#313131',
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
