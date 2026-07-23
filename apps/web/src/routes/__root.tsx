import { StyleProvider } from '@ant-design/cssinjs';
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { DR_PRIMARY } from '../constants/theme';
import { AppThemeProvider } from '../context/AppThemeContext';
import { useAppTheme } from '../hooks/useAppTheme';

export const Route = createRootRoute({
  component: RootComponent,
});

function ThemedApp() {
  const { resolved } = useAppTheme();

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm:
          resolved === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: DR_PRIMARY,
          borderRadius: 8,
          fontFamily:
            "system-ui, -apple-system, 'PingFang SC', 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
        },
      }}
    >
      <div className="min-h-dvh w-full dr-app text-[var(--dr-text)] antialiased flex flex-col">
        <Outlet />
      </div>
    </ConfigProvider>
  );
}

function RootComponent() {
  return (
    <AppThemeProvider>
      <StyleProvider layer>
        <ThemedApp />
      </StyleProvider>
    </AppThemeProvider>
  );
}
