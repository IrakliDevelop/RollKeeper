'use client';

import { ThemeContext, useThemeInit } from '@/hooks/useTheme';

export function ThemeProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const themeValue = useThemeInit();

  return (
    <ThemeContext.Provider value={themeValue}>{children}</ThemeContext.Provider>
  );
}
