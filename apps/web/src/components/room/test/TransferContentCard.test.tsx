import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TextBlock } from '../TransferContentCard';

let root: Root;
let container: HTMLDivElement;

describe('TextBlock', () => {
  beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
  });

  it('限制文字气泡高度并使用可聚焦的美化滚动区', () => {
    act(() => root.render(<TextBlock content="很长的文字" />));

    const textBlock = container.querySelector('p');
    expect(textBlock?.classList).toContain('max-h-64');
    expect(textBlock?.classList).toContain('overflow-y-auto');
    expect(textBlock?.classList).toContain('dr-scrollbar');
    expect(textBlock?.tabIndex).toBe(0);
  });
});
