import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getMyNickname,
  getRoomLayoutPrefs,
  getThemeMode,
  resolveTheme,
  setRoomLayoutPrefs,
  setThemeMode,
} from '../preferences';

describe('preferences nickname', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('首次访问时从扩展词库生成并保存昵称', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);

    expect(getMyNickname()).toBe('闪耀的坐标');
    expect(localStorage.getItem('droproom-user-nickname')).toBe('闪耀的坐标');
  });
});

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
