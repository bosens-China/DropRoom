import { createContext } from 'react';
import type { ResolvedTheme, ThemeMode } from '../utils/preferences';

export interface AppThemeContextValue {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

export const AppThemeContext = createContext<AppThemeContextValue | null>(null);
