import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getBrowserNotificationsEnabled,
  getMyNickname,
  getRoomLayoutPrefs,
  getThemeMode,
  resolveTheme,
  setBrowserNotificationsEnabled,
  setRoomLayoutPrefs,
  setThemeMode,
} from '../preferences';

describe('preferences browser notifications', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('默认关闭并保存用户选择', () => {
    expect(getBrowserNotificationsEnabled()).toBe(false);
    setBrowserNotificationsEnabled(true);
    expect(getBrowserNotificationsEnabled()).toBe(true);
    setBrowserNotificationsEnabled(false);
    expect(getBrowserNotificationsEnabled()).toBe(false);
  });
});

describe('preferences nickname', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('首次访问时从扩展词库生成并保存昵称', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);

    const nickname = getMyNickname();
    expect(nickname.length).toBeGreaterThan(0);
    expect(localStorage.getItem('droproom-user-nickname')).toBe(nickname);
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
