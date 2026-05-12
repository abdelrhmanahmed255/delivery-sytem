import { useCallback, useEffect, useState } from 'react';

/**
 * Persistent dark-mode toggle for the admin dashboard.
 *
 * Storage key: `adminTheme` — values are `'dark'` or `'light'`. We default
 * to light when nothing is stored, matching the existing UI; switching the
 * theme adds/removes a `dark` class on `<html>` which Tailwind v4 picks up
 * via the `@custom-variant dark` declared in `index.css`.
 */
const STORAGE_KEY = 'adminTheme';

type Theme = 'light' | 'dark';

const readStoredTheme = (): Theme => {
  if (typeof window === 'undefined') return 'light';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

const applyThemeToDocument = (theme: Theme) => {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
};

export function useDarkMode() {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    applyThemeToDocument(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage can be disabled (e.g. private mode) — non-fatal.
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, isDark: theme === 'dark', toggle, setTheme };
}
