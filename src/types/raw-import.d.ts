// Storybook and Vitest (both Vite) import a file's text with `?raw`. The
// Next app itself never uses it.
declare module '*?raw' {
  const content: string;
  export default content;
}
