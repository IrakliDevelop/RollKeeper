import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        'bg-primary': 'var(--color-bg-primary)',
        'bg-secondary': 'var(--color-bg-secondary)',
        'bg-tertiary': 'var(--color-bg-tertiary)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-tertiary': 'var(--color-text-tertiary)',
        'border-primary': 'var(--color-border-primary)',
        'border-secondary': 'var(--color-border-secondary)',
        'card-bg': 'var(--color-card-bg)',
        'card-border': 'var(--color-card-border)',
        'card-hover': 'var(--color-card-hover)',
      },
      backgroundImage: {
        'gradient-slate':
          'linear-gradient(to bottom right, var(--gradient-slate-from), var(--gradient-slate-to))',
        'gradient-blue':
          'linear-gradient(to bottom right, var(--gradient-blue-from), var(--gradient-blue-to))',
        'gradient-green':
          'linear-gradient(to bottom right, var(--gradient-green-from), var(--gradient-green-to))',
        'gradient-purple':
          'linear-gradient(to bottom right, var(--gradient-purple-from), var(--gradient-purple-to))',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)'],
        mono: ['var(--font-geist-mono)'],
      },
    },
  },
  plugins: [],
};

export default config;
