import { describe, expect, it } from 'vitest';
import { formatFileSize } from '../format';

describe('formatFileSize', () => {
  it('按产品约定使用十进制容量单位', () => {
    expect(formatFileSize(100_000_000)).toBe('100 MB');
    expect(formatFileSize(2_000_000_000)).toBe('2 GB');
  });
});
