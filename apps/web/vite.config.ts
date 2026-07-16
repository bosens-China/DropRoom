import { defineConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import UnoCSS from 'unocss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

export default defineConfig({
  build: {
    target: ['chrome111', 'edge111', 'firefox114', 'safari16.4', 'ios16.4'],
    rolldownOptions: {
      output: {
        // 控制大型依赖块尺寸，配合 Nginx 的哈希资源长期缓存。
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 30,
            },
            {
              name: 'tanstack',
              test: /node_modules[\\/]@tanstack[\\/]/,
              priority: 20,
            },
            {
              name: 'antd',
              test: /node_modules[\\/](antd|@ant-design[\\/]|rc-)/,
              priority: 10,
              maxSize: 350 * 1024,
            },
            {
              name: 'vendor',
              test: /node_modules/,
              maxSize: 350 * 1024,
            },
          ],
        },
      },
    },
  },
  plugins: [
    TanStackRouterVite({
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
    }),
    UnoCSS(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
});
