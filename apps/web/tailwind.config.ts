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
      backgroundImage: {
        'gradient-slate':
          'linear-gradient(to bottom right, var(--gradient-slate-from), var(--gradient-slate-to))',
        'gradient-blue':
          'linear-gradient(to bottom right, var(--gradient-blue-from), var(--gradient-blue-to))',
        'gradient-green':
          'linear-gradient(to bottom right, var(--gradient-green-from), var(--gradient-green-to))',
        'gradient-purple':
          'linear-gradient(to bottom right, var(--gradient-purple-from), var(--gradient-purple-to))',
        'gradient-emerald':
          'linear-gradient(to bottom right, var(--gradient-emerald-from), var(--gradient-emerald-to))',
        'gradient-amber':
          'linear-gradient(to bottom right, var(--gradient-amber-from), var(--gradient-amber-to))',
        'gradient-red':
          'linear-gradient(to bottom right, var(--gradient-red-from), var(--gradient-red-to))',
        'gradient-indigo':
          'linear-gradient(to bottom right, var(--gradient-indigo-from), var(--gradient-indigo-to))',
        'gradient-page':
          'linear-gradient(to bottom right, var(--gradient-page-from), var(--gradient-page-via), var(--gradient-page-to))',
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
