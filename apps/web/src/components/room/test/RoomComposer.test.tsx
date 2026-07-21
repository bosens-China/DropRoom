import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomComposer } from '../RoomComposer';

let root: Root;
let container: HTMLDivElement;

describe('RoomComposer', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it.each([
    ['Windows / Linux', { ctrlKey: true }],
    ['macOS', { metaKey: true }],
  ])('%s 全选快捷键聚焦并选择发送框内容', async (_system, modifier) => {
    await act(async () => {
      root.render(
        <RoomComposer
          inputText="准备发送的文字"
          maxTextLength={20_000}
          isDragging={false}
          isSending={false}
          onInputChange={vi.fn()}
          onSend={vi.fn()}
          onImageSelect={vi.fn()}
          onVideoSelect={vi.fn()}
          onFileSelect={vi.fn()}
          onPasteFiles={vi.fn()}
        />,
      );
    });

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'a',
          cancelable: true,
          ...modifier,
        }),
      );
    });

    const textarea = container.querySelector('textarea');
    expect(document.activeElement).toBe(textarea);
    expect(textarea?.selectionStart).toBe(0);
    expect(textarea?.selectionEnd).toBe('准备发送的文字'.length);
  });

  it('不拦截其他输入框的原生全选', async () => {
    await act(async () => {
      root.render(
        <RoomComposer
          inputText="发送框内容"
          maxTextLength={20_000}
          isDragging={false}
          isSending={false}
          onInputChange={vi.fn()}
          onSend={vi.fn()}
          onImageSelect={vi.fn()}
          onVideoSelect={vi.fn()}
          onFileSelect={vi.fn()}
          onPasteFiles={vi.fn()}
        />,
      );
    });
    const otherInput = document.createElement('input');
    container.append(otherInput);
    otherInput.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'a',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    otherInput.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(otherInput);
  });
});
