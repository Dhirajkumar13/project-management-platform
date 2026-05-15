import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx}',
    './src/store/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  safelist: [
    'bg-surface-nav', 'bg-surface-bg', 'bg-surface-card', 'bg-surface-elevated',
    'dark:bg-surface-nav', 'dark:bg-surface-bg', 'dark:bg-surface-card', 'dark:bg-surface-elevated',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#09090b',
        },
        // Dark-mode surface hierarchy — use these for dark:bg-* instead of raw zinc values.
        // Layers (darkest→lightest): nav → bg → card → elevated
        surface: {
          nav:      '#0D1117',
          bg:       '#111318',
          card:     '#1C1F26',
          elevated: '#22262F',
        },
      },
      letterSpacing: {
        tighter: '-0.04em',
        tight:   '-0.02em',
      },
      boxShadow: {
        card:       '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'card-md':  '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
        'dark-card': '0 1px 3px 0 rgb(0 0 0 / 0.4), 0 1px 2px -1px rgb(0 0 0 / 0.3)',
      },
    },
  },
  plugins: [],
}

export default config
