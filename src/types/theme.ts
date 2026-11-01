export type Theme = 'light' | 'dark' | 'blue' | 'system';
export type ResolvedTheme = Exclude<Theme, 'system'>;
