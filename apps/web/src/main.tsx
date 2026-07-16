import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import '@unocss/reset/tailwind.css';
import 'virtual:uno.css';
import './index.css';

// 导入自动生成的路由树
import { routeTree } from './routeTree.gen';

// 创建路由实例
const router = createRouter({ routeTree });

// 注册路由实例以提供强类型支持
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
