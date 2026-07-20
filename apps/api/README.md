# DropRoom API

DropRoom 一期后端基于 Hono、Node.js 和 TypeScript，实现单实例临时房间、SSE 实时事件、文字历史以及文件临时存储。

## 开发命令

```bash
pnpm --filter @droproom/api dev
pnpm --filter @droproom/api test
pnpm --filter @droproom/api typecheck
pnpm --filter @droproom/api build
pnpm --filter @droproom/api start
```

`dev` 使用 `tsx watch`，`start` 使用 `tsx` 直接启动 `src/index.ts`；Docker
生产镜像同样使用 `tsx`，不依赖预编译的 `dist` 目录。

从仓库根目录构建并运行生产镜像：

```bash
pnpm docker:build
pnpm docker:up
```

完整容器环境的 Web 入口为 `http://localhost:48080`，API 仍额外映射到
`http://localhost:43117` 方便本地检查。

默认监听：

```text
http://localhost:43117
```

健康检查：

```text
GET /health
```

接口文档：

```text
Swagger UI: http://localhost:43117/docs
OpenAPI JSON: http://localhost:43117/openapi.json
```

## 环境变量

环境变量由 `dotenv` 加载，并统一通过 Zod 校验。本地开发不需要创建 `.env`；生产环境需要填写：

```dotenv
NODE_ENV=production
DROPROOM_CORS_ORIGINS=https://your-web.example.com
DROPROOM_REDIS_URL=rediss://username:password@your-redis.example.com:6380
```

可以复制 [`.env.example`](./.env.example) 作为起点。

常用可选配置：

| 变量                          | 默认值                      | 说明                                  |
| ----------------------------- | --------------------------- | ------------------------------------- |
| `DROPROOM_API_PORT`           | `43117`                     | API 监听端口                          |
| `DROPROOM_REDIS_URL`          | `redis://127.0.0.1:46379`   | Redis 连接地址                        |
| `DROPROOM_REDIS_KEY_PREFIX`   | `droproom`                  | Redis 键前缀                          |
| `DROPROOM_STORAGE_ROOT`       | 系统临时目录下的 `droproom` | 文件临时存储专用目录                  |
| `DROPROOM_CORS_ORIGINS`       | `http://localhost:5173`     | 允许的 Web 来源，多个来源使用逗号分隔 |
| `DROPROOM_LOG_LEVEL`          | `info`                      | Pino日志级别                          |
| `DROPROOM_OPENAPI_ENABLED`    | `true`                      | 是否开放接口文档                      |
| `DROPROOM_OPENAPI_JSON_PATH`  | `/openapi.json`             | OpenAPI 3.1 JSON路径                  |
| `DROPROOM_SWAGGER_PATH`       | `/docs`                     | Swagger UI路径                        |
| `DROPROOM_UPLOAD_CHUNK_BYTES` | `2000000`                   | 单个上传分片的最大字节数              |
| `DROPROOM_GLOBAL_FILE_BYTES`  | `30000000000`               | 单实例全局文件容量安全上限            |

`DROPROOM_STORAGE_ROOT` 必须是 DropRoom 独占目录。服务启动时会清理该目录，进程重启视为所有临时房间销毁。

其他容量、生命周期、心跳和限流配置也可以通过环境变量覆盖，名称与 [env.ts](./src/config/env.ts) 中的 Zod Schema一致。配置不合法时服务会拒绝启动。

## 源码目录

```text
src/
  index.ts              服务入口
  api/                  Hono 应用、OpenAPI、HTTP 辅助逻辑
  config/               环境变量与配置校验
  infrastructure/       Redis、日志和共享限流
  room/                 房间领域模型与存储实现
  shared/               跨模块错误类型
  test/                 跨模块测试辅助
```

每个重要模块的测试位于对应目录的 `test/` 子目录。

## 日志

- 使用 Pino 输出结构化 JSON日志。
- 每个请求自动生成或沿用 `X-Request-Id`，响应会返回同一个请求 ID。
- 请求完成日志包含方法、路径、状态码和耗时。
- `Authorization` 和 `memberToken` 会自动脱敏。
- 可以通过 `DROPROOM_LOG_LEVEL` 调整日志级别。

生产环境应由容器平台或日志采集器处理标准输出，不在应用进程内直接写日志文件。

## Swagger 与 OpenAPI

- OpenAPI 3.1文档从实际 Zod请求和响应模型生成。
- Swagger UI支持直接测试普通 HTTP接口和 Bearer成员凭证。
- SSE和原始二进制文件上传/下载接口也包含在规范中。
- 生产环境不希望公开文档时，可以设置 `DROPROOM_OPENAPI_ENABLED=false`。

## 技术模型

- 房间、成员、文字历史和文件元信息保存在当前进程内存。
- 文件内容写入本机临时目录，不进入数据库。
- 所有客户端写操作使用普通 HTTP。
- 服务端通过 SSE 向房间成员广播变化。
- 文件下载使用浏览器原生 HTTP 下载。
- 当前实现是单实例模型，不支持多进程共享房间状态。
- Pino负责结构化请求日志。
- `@hono/zod-openapi` 与 `@hono/swagger-ui` 提供接口规范和交互文档。

前端应通过 `@droproom/api/app` 导入 `AppType`，并使用 Hono `hc` 创建类型安全客户端。SSE 事件和数据类型可以从 `@droproom/api/domain` 导入。

## 成员凭证

创建或加入房间后，接口返回 `memberToken`，同时写入当前房间独立的 HttpOnly Cookie。浏览器客户端使用 Cookie，其他 API 客户端也可以使用：

```http
Authorization: Bearer <memberToken>
```

SSE、图片预览和浏览器下载使用房间 Cookie，URL 不包含成员凭证。生产环境必须使用 HTTPS。

## 接口概览

| 方法     | 路径                                 | 说明                       |
| -------- | ------------------------------------ | -------------------------- |
| `GET`    | `/health`                            | 健康检查                   |
| `POST`   | `/rooms`                             | 创建房间                   |
| `POST`   | `/rooms/:code/join`                  | 加入或使用已有凭证重连房间 |
| `GET`    | `/rooms/:code`                       | 获取当前房间快照           |
| `GET`    | `/rooms/:code/events`                | 建立 SSE 连接              |
| `PATCH`  | `/rooms/:code/members/me`            | 修改自己的昵称             |
| `POST`   | `/rooms/:code/leave`                 | 主动退出房间               |
| `PATCH`  | `/rooms/:code`                       | 房主修改房间名称           |
| `DELETE` | `/rooms/:code`                       | 房主解散房间               |
| `POST`   | `/rooms/:code/messages`              | 发送文字                   |
| `POST`   | `/rooms/:code/uploads`               | 创建文件批次并预占容量     |
| `PUT`    | `/rooms/:code/files/:fileId/content` | 上传一个文件分片           |
| `POST`   | `/rooms/:code/files/:fileId/cancel`  | 取消上传                   |
| `DELETE` | `/rooms/:code/files/:fileId`         | 删除文件                   |
| `GET`    | `/rooms/:code/files/:fileId/content` | 预览或下载文件             |

## 主要请求

### 创建房间

```http
POST /rooms
Content-Type: application/json

{
  "nickname": "我的设备"
}
```

### 加入或重连

```http
POST /rooms/01234567/join
Content-Type: application/json

{
  "nickname": "另一台设备",
  "memberToken": "非浏览器客户端可选，浏览器使用房间 Cookie 重连"
}
```

### 发送文字

```http
POST /rooms/01234567/messages
Authorization: Bearer <memberToken>
Content-Type: application/json

{
  "content": "需要传输的文字"
}
```

### 文件上传

文件采用“预留批次 + 固定分片上传”流程。

第一步，预留容量：

```http
POST /rooms/01234567/uploads
Authorization: Bearer <memberToken>
Content-Type: application/json

{
  "files": [
    {
      "name": "document.pdf",
      "size": 102400,
      "mimeType": "application/pdf",
      "fingerprint": "64位十六进制文件指纹"
    }
  ]
}
```

第二步，从服务端返回的 `uploadedBytes` 开始上传分片：

```http
PUT /rooms/01234567/files/<fileId>/content
Authorization: Bearer <memberToken>
Upload-Offset: 0
X-Chunk-Sha256: <当前分片的SHA-256>
X-File-Fingerprint: <预留时提交的文件指纹>
Content-Length: <当前分片大小>
Content-Type: application/octet-stream

<当前分片内容>
```

每个分片默认不超过2,000,000字节。服务端校验上传偏移、文件指纹和分片摘要，成功后更新 `uploadedBytes`。网络中断时保留已经完成的分片，客户端可以从最新偏移继续。

### 文件下载与图片预览

```text
GET /rooms/01234567/files/<fileId>/content?mode=attachment
GET /rooms/01234567/files/<fileId>/content?mode=inline
```

`inline` 仅允许 PNG、JPEG、GIF、WebP 和 AVIF，其他类型自动作为附件下载。

## SSE 事件

SSE 连接建立后首先发送完整 `room.snapshot`。后续可能收到：

- `presence.changed`
- `room.updated`
- `item.created`
- `item.updated`
- `room.destroyed`
- `heartbeat`

客户端断线重连后不依赖事件补发，而是重新接收完整房间快照。

## 一期限制

- 8位随机数字房间码
- 每个房间最多9名成员
- 单条文字最多20,000字符
- 单批最多50个文件，合计不超过300,000,000字节；不另设单文件上限，单个文件仍受批次上限约束
- 单房间文件总量不超过1,000,000,000字节
- 单实例全部房间文件总量不超过30,000,000,000字节
- 每名成员最多3个实际进行中的上传请求
- 房间创建同 IP 每10分钟最多10次
- 无效房间码同 IP 每分钟最多10次
- 房间无人在线5分钟后销毁
- 房间创建24小时后强制销毁

## 反向代理要求

- 正确传递并覆盖 `X-Forwarded-For`，不要信任客户端自行提供的值。
- SSE 路径关闭代理缓冲，并允许长连接。
- 上传路径允许至少3 MB请求体，并配置不少于5分钟的上传超时。
- 下载路径保留 `Content-Length` 和 `Content-Disposition`。
- 公网环境必须启用 HTTPS。
