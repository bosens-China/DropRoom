import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { ApiConfig } from '../config/env.js';
import type { AppEnv } from './http.js';

export function registerApiDocs(
  api: OpenAPIHono<AppEnv>,
  config: ApiConfig,
): void {
  if (!config.openApiEnabled) {
    return;
  }

  api.doc31(config.openApiJsonPath, (context) => ({
    openapi: '3.1.0',
    info: {
      title: 'DropRoom API',
      version: '1.0.0',
      description: '多人临时房间文字与文件传输接口',
    },
    servers: [
      {
        url: new URL(context.req.url).origin,
        description: '当前环境',
      },
    ],
    tags: [
      { name: '系统', description: '健康检查和服务状态' },
      { name: '房间', description: '房间创建、加入与快照' },
      { name: '成员', description: '临时成员操作' },
      { name: '房主', description: '房主管理操作' },
      { name: '内容', description: '文字内容' },
      { name: '文件', description: '文件预留、上传和下载' },
      { name: '实时事件', description: 'SSE 房间事件' },
    ],
  }));
  api.get(
    config.swaggerPath,
    swaggerUI({
      url: config.openApiJsonPath,
      title: 'DropRoom API 文档',
      persistAuthorization: true,
      displayRequestDuration: true,
    }),
  );
}
