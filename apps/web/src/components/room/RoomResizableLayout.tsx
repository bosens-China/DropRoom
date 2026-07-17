import {
  useCallback,
  useState,
  type DragEventHandler,
  type ReactNode,
} from 'react';
import { Splitter } from 'antd';
import {
  getRoomLayoutPrefs,
  setRoomLayoutPrefs,
} from '../../utils/preferences';

interface RoomResizableLayoutProps {
  sidebar: ReactNode;
  header: ReactNode;
  timeline: ReactNode;
  composer: ReactNode;
  onDragOver: DragEventHandler<HTMLElement>;
  onDragLeave: DragEventHandler<HTMLElement>;
  onDrop: DragEventHandler<HTMLElement>;
}

/** 聊天主栏：顶栏固定 + 消息区滚动 + 底栏固定 */
function ChatColumn({
  header,
  timeline,
  composer,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  header: ReactNode;
  timeline: ReactNode;
  composer?: ReactNode;
  onDragOver: DragEventHandler<HTMLElement>;
  onDragLeave: DragEventHandler<HTMLElement>;
  onDrop: DragEventHandler<HTMLElement>;
}) {
  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden dr-chat-bg"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="shrink-0">{header}</div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {timeline}
      </div>
      {composer ? <div className="shrink-0">{composer}</div> : null}
    </div>
  );
}

/** 房间主布局：桌面端 Splitter 拖拽调整，尺寸写入 localStorage */
export function RoomResizableLayout({
  sidebar,
  header,
  timeline,
  composer,
  onDragOver,
  onDragLeave,
  onDrop,
}: RoomResizableLayoutProps) {
  const [layout, setLayout] = useState(getRoomLayoutPrefs);

  const saveSidebar = useCallback((sizes: number[]) => {
    const sidebarSize = sizes[0];
    if (sidebarSize === undefined) return;
    setLayout((prev) => {
      const next = { ...prev, sidebarSize };
      setRoomLayoutPrefs({ sidebarSize });
      return next;
    });
  }, []);

  const saveComposer = useCallback((sizes: number[]) => {
    const composerSize = sizes[1];
    if (composerSize === undefined) return;
    setLayout((prev) => {
      const next = { ...prev, composerSize };
      setRoomLayoutPrefs({ composerSize });
      return next;
    });
  }, []);

  return (
    <div className="room-layout flex min-h-0 flex-1 w-full">
      {/* 桌面：侧栏 + 纵向分割（消息区 / 输入区） */}
      <div className="room-layout-desktop hidden h-full min-h-0 w-full md:flex">
        <Splitter
          className="room-splitter h-full w-full"
          onResizeEnd={saveSidebar}
        >
          <Splitter.Panel defaultSize={layout.sidebarSize} min={200} max={360}>
            <div className="h-full min-h-0 overflow-hidden">{sidebar}</div>
          </Splitter.Panel>
          <Splitter.Panel>
            <Splitter
              orientation="vertical"
              className="room-splitter h-full"
              onResizeEnd={saveComposer}
            >
              <Splitter.Panel min="35%">
                <ChatColumn
                  header={header}
                  timeline={timeline}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                />
              </Splitter.Panel>
              <Splitter.Panel
                defaultSize={layout.composerSize}
                min={120}
                max="55%"
                className="dr-chat-bg"
              >
                <div className="h-full min-h-0">{composer}</div>
              </Splitter.Panel>
            </Splitter>
          </Splitter.Panel>
        </Splitter>
      </div>

      {/* 移动：单栏纵向堆叠 */}
      <div className="room-layout-mobile flex h-full min-h-0 w-full flex-col md:hidden">
        <ChatColumn
          header={header}
          timeline={timeline}
          composer={composer}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        />
      </div>
    </div>
  );
}
