<p align="center">
  <img src="./apps/web/public/droproom-logo.svg" width="420" alt="DropRoom" />
</p>

<p align="center">无需注册的临时房间文件传输工具。</p>

DropRoom 通过临时房间在多台设备或多人之间传递文字、图片和文件。房间最长存续 24 小时，销毁后不保留内容。

## 功能

- 8 位房间码，无需注册登录
- 一键创建并复制邀请链接
- 实时同步文字、图片和文件
- 文件分片上传、断点续传与容量状态
- 每个房间最多 9 名成员
- 房间到期或无人在线后自动清理
- OpenAPI 文档与 Swagger UI

一期界面一次只展示一个当前房间；多房间列表和快速切换计划在二期提供。

## 快速开始

需要 Node.js、pnpm 10 和 Docker。

```bash
pnpm install
pnpm infra:up
pnpm dev
```

- Redis：localhost:46379
- Web：http://localhost:5173
- API：http://localhost:43117
- Swagger UI：http://localhost:43117/docs

Redis 由根目录 [`compose.yaml`](./compose.yaml) 启动并启用 AOF。停止开发基础设施可运行：

```bash
pnpm infra:down
```

本地开发无需配置环境变量。独立部署时参考
[`apps/api/.env.example`](./apps/api/.env.example) 和
[`apps/web/.env.example`](./apps/web/.env.example)，Web 通过
`VITE_API_BASE_URL` 指向 Hono API；Docker 生产镜像默认使用同源 `/api`。

## 常用命令

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm --filter @droproom/api test
pnpm --filter @droproom/web test
pnpm docker:build
pnpm docker:up
pnpm docker:down
pnpm docker:prod:up
pnpm docker:prod:down
```

`pnpm docker:up` 使用 [`compose.build.yaml`](./compose.build.yaml) 从源码构建
`boses/droproom-web:local` 和 `boses/droproom-api:local`，并同时启动 Web、API
与 Redis：

- Web：http://localhost:48080
- API：http://localhost:43117
- Swagger UI：http://localhost:43117/docs

Web 生产镜像将 `VITE_API_BASE_URL` 固定为同源 `/api`。Nginx 负责 SPA
路由回退、静态资源长期缓存、gzip、SSE 关闭缓冲以及大文件上传代理。

## 生产 Compose 示例

[`compose.production.yaml`](./compose.production.yaml) 使用 Docker Hub 发布镜像。
默认在 `48080` 端口提供 Web，API 和 Redis 仅在 Compose 内部网络通信：

```bash
DROPROOM_CORS_ORIGINS=https://drop.example.com \
DROPROOM_WEB_PORT=48080 \
pnpm docker:prod:up
```

公网部署时应由宿主机反向代理或负载均衡器为 `48080` 端口提供 HTTPS。升级到指定版本：

```bash
DROPROOM_IMAGE_TAG=1.2.3 pnpm docker:prod:up
```

完整的 TLS、反向代理、告警和异常清理要求见
[`docs/phase-1/production-runbook.md`](./docs/phase-1/production-runbook.md)。

## Docker 镜像

GitHub Actions 会执行前后端 lint、类型检查、测试和构建，然后发布
`linux/amd64` 镜像：

```text
boses/droproom-api
boses/droproom-web
```

- 合并或推送到 `main`：推送 `latest`、`main` 和提交 SHA 标签。
- 推送 `v1.2.3` 格式的 Git tag：推送语义化版本标签。
- Pull Request：测试并构建两个镜像，但不推送。

仓库需要配置 GitHub Actions Secret：`DOCKERHUB_TOKEN`。

## 技术栈

- Web：React、React Compiler、Vite、Ant Design、UnoCSS、Hono `hc`
- API：Hono、Zod、SSE、Pino、Redis
- 工程：TypeScript、pnpm monorepo、Vitest

## 项目结构

```text
apps/
  web/        Web 客户端
  api/        Hono API 服务
docs/         产品需求与开发计划
```

当前房间状态仍使用单实例内存和本地临时文件。连续 5 分钟无人在线、达到 24 小时上限或服务重启时，系统会销毁房间。创建与加入限流通过 Redis 保存。

## License

[MIT](./LICENSE)
