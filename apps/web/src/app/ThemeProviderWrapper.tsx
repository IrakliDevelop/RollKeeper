'use client';

import { ThemeContext, useThemeInit } from '@/hooks/useTheme';
import { AuthProvider } from '@/contexts/AuthContext';

export function ThemeProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const themeValue = useThemeInit();

  return (
    <ThemeContext.Provider value={themeValue}>
      <AuthProvider>{children}</AuthProvider>
    </ThemeContext.Provider>
  );
}
