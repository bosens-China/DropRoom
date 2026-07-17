import { afterEach, describe, expect, it, vi } from 'vitest';

describe('API 客户端地址', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('将生产环境的相对 API 地址解析为当前站点的绝对地址', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '/api');

    const { API_BASE_URL, fileContentUrl, roomEventsUrl } =
      await import('../client');

    expect(API_BASE_URL).toBe(`${window.location.origin}/api`);
    expect(roomEventsUrl('84528221')).toBe(
      `${window.location.origin}/api/rooms/84528221/events`,
    );
    expect(fileContentUrl('84528221', 'file-id', 'inline')).toBe(
      `${window.location.origin}/api/rooms/84528221/files/file-id/content?mode=inline`,
    );
  });

  it('保留开发环境配置的绝对 API 地址', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:43117');

    const { API_BASE_URL } = await import('../client');

    expect(API_BASE_URL).toBe('http://localhost:43117/');
  });
});
