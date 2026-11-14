import localFont from 'next/font/local';

// Felt and Brass type: Vollkorn for headings, Barlow for body and UI,
// Barlow Condensed for display numerals. Self-hosted latin subsets from
// Fontsource 5.3.0 (SIL OFL 1.1, see ./fonts/README.md).
const vollkorn = localFont({
  src: './fonts/vollkorn-latin-wght-normal.woff2',
  variable: '--font-vollkorn',
  weight: '400 900',
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
});

const barlow = localFont({
  src: [
    {
      path: './fonts/barlow-latin-400-normal.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/barlow-latin-400-italic.woff2',
      weight: '400',
      style: 'italic',
    },
    {
      path: './fonts/barlow-latin-500-normal.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: './fonts/barlow-latin-600-normal.woff2',
      weight: '600',
      style: 'normal',
    },
  ],
  variable: '--font-barlow',
  display: 'swap',
});

const barlowCondensed = localFont({
  src: [
    {
      path: './fonts/barlow-condensed-latin-600-normal.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: './fonts/barlow-condensed-latin-700-normal.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-barlow-condensed',
  display: 'swap',
});

// The font variables live on <html> so the theme tokens declared on :root
// (--font-body-family and friends) can resolve them.
export const FONT_VARIABLES = `${vollkorn.variable} ${barlow.variable} ${barlowCondensed.variable}`;
