import { createRootRoute, Outlet } from '@tanstack/react-router';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';

// 根路由：Ant Design 主题 + 全宽页面容器
export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#3b82f6',
          borderRadius: 10,
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
        },
      }}
    >
      <div className="min-h-dvh w-full text-slate-800 antialiased">
        <Outlet />
      </div>
    </ConfigProvider>
  );
}
