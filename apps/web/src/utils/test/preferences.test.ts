import { afterEach, describe, expect, it } from 'vitest';
import {
  getRoomLayoutPrefs,
  getThemeMode,
  resolveTheme,
  setRoomLayoutPrefs,
  setThemeMode,
} from '../preferences';

describe('preferences theme', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('defaults to system theme', () => {
    expect(getThemeMode()).toBe('system');
  });

  it('persists theme mode', () => {
    setThemeMode('dark');
    expect(getThemeMode()).toBe('dark');
    setThemeMode('light');
    expect(getThemeMode()).toBe('light');
  });

  it('resolves explicit light and dark', () => {
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });
});

describe('preferences room layout', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('returns defaults when empty', () => {
    expect(getRoomLayoutPrefs()).toEqual({
      sidebarSize: 240,
      composerSize: 168,
    });
  });

  it('persists partial layout updates', () => {
    setRoomLayoutPrefs({ sidebarSize: 280 });
    expect(getRoomLayoutPrefs().sidebarSize).toBe(280);
    expect(getRoomLayoutPrefs().composerSize).toBe(168);
  });
});
