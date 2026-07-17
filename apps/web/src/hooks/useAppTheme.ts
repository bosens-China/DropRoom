import { useContext } from 'react';
import { AppThemeContext } from '../context/appThemeState';

export function useAppTheme() {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme 必须在 AppThemeProvider 内使用');
  }
  return ctx;
}
