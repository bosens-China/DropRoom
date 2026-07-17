import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getThemeMode,
  resolveTheme,
  setThemeMode,
  type ResolvedTheme,
  type ThemeMode,
} from '../utils/preferences';
import { AppThemeContext } from './appThemeState';

function applyResolvedTheme(resolved: ResolvedTheme) {
  document.documentElement.dataset.theme = resolved;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

/** 全局主题：支持浅色 / 深色 / 跟随系统 */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => getThemeMode());
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolveTheme(getThemeMode()),
  );

  const setMode = useCallback((next: ThemeMode) => {
    setThemeMode(next);
    setModeState(next);
    setResolved(resolveTheme(next));
  }, []);

  useEffect(() => {
    applyResolvedTheme(resolved);
  }, [resolved]);

  useEffect(() => {
    if (mode !== 'system') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setResolved(resolveTheme('system'));
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [mode]);

  const value = useMemo(
    () => ({ mode, resolved, setMode }),
    [mode, resolved, setMode],
  );

  return (
    <AppThemeContext.Provider value={value}>
      {children}
    </AppThemeContext.Provider>
  );
}
