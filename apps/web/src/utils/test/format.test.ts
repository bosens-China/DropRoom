import { describe, expect, it } from 'vitest';
import { formatFileSize } from '../format';

describe('formatFileSize', () => {
  it('按产品约定使用十进制可读单位并保留最多一位小数', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(999)).toBe('999 B');
    expect(formatFileSize(1_000)).toBe('1 KB');
    expect(formatFileSize(1_500)).toBe('1.5 KB');
    expect(formatFileSize(1_000_000)).toBe('1 MB');
    expect(formatFileSize(12_500_000)).toBe('12.5 MB');
    expect(formatFileSize(1_000_000_000)).toBe('1 GB');
  });
});
