const LOCAL_NICKNAME_KEY = 'droproom-user-nickname';
const THEME_MODE_KEY = 'droproom-theme-mode';
const ROOM_LAYOUT_KEY = 'droproom-room-layout';
const BROWSER_NOTIFICATIONS_KEY = 'droproom-browser-notifications';

/**
 * 浏览器 localStorage 键一览（均仅存于本机，不上传服务器）：
 * - droproom-user-nickname：用户昵称
 * - droproom-theme-mode：主题（light / dark / system）
 * - droproom-room-layout：房间页分栏尺寸（侧栏宽度、发送区高度）
 * - droproom-browser-notifications：是否显示浏览器消息通知
 * - droproom-joined-rooms：已加入房间列表（见 roomRegistry.ts）
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface RoomLayoutPrefs {
  sidebarSize: number;
  composerSize: number;
}

const DEFAULT_LAYOUT: RoomLayoutPrefs = {
  sidebarSize: 240,
  composerSize: 168,
};

export function getMyNickname(): string {
  const stored = localStorage.getItem(LOCAL_NICKNAME_KEY);
  if (stored) return stored;

  const adjectives = [
    '神秘',
    '快乐',
    '敏捷',
    '沉静',
    '炽热',
    '深邃',
    '优雅',
    '无畏',
    '好奇',
    '可靠',
    '专注',
    '从容',
    '机敏',
    '友善',
    '清醒',
    '浪漫',
    '坚定',
    '自在',
    '温柔',
    '闪耀',
  ];
  const nouns = [
    '极客',
    '节点',
    '信使',
    '原点',
    '光纤',
    '代码',
    '网关',
    '星宿',
    '向导',
    '旅人',
    '工匠',
    '卫星',
    '脉冲',
    '像素',
    '模块',
    '终端',
    '探针',
    '密钥',
    '引擎',
    '坐标',
  ];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const nickname = `${adjective}的${noun}`;
  localStorage.setItem(LOCAL_NICKNAME_KEY, nickname);
  return nickname;
}

export function setMyNickname(nickname: string): void {
  localStorage.setItem(LOCAL_NICKNAME_KEY, nickname);
}

export function getThemeMode(): ThemeMode {
  const stored = localStorage.getItem(THEME_MODE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

export function setThemeMode(mode: ThemeMode): void {
  localStorage.setItem(THEME_MODE_KEY, mode);
}

export function getBrowserNotificationsEnabled(): boolean {
  return localStorage.getItem(BROWSER_NOTIFICATIONS_KEY) === 'true';
}

export function setBrowserNotificationsEnabled(enabled: boolean): void {
  localStorage.setItem(BROWSER_NOTIFICATIONS_KEY, String(enabled));
}

export function getRoomLayoutPrefs(): RoomLayoutPrefs {
  try {
    const raw = localStorage.getItem(ROOM_LAYOUT_KEY);
    if (!raw) return { ...DEFAULT_LAYOUT };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return { ...DEFAULT_LAYOUT };
    }
    const record = parsed as Record<string, unknown>;
    return {
      sidebarSize:
        typeof record.sidebarSize === 'number'
          ? record.sidebarSize
          : DEFAULT_LAYOUT.sidebarSize,
      composerSize:
        typeof record.composerSize === 'number'
          ? record.composerSize
          : DEFAULT_LAYOUT.composerSize,
    };
  } catch {
    return { ...DEFAULT_LAYOUT };
  }
}

export function setRoomLayoutPrefs(prefs: Partial<RoomLayoutPrefs>): void {
  const current = getRoomLayoutPrefs();
  localStorage.setItem(
    ROOM_LAYOUT_KEY,
    JSON.stringify({ ...current, ...prefs }),
  );
}

/** 将主题偏好解析为实际 light / dark */
export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return mode;
}
