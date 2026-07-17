# DropRoom 一期生产部署与运维手册

## 部署边界

- Web 是唯一需要对外提供的容器端口。
- 官方发布镜像仅支持 `linux/amd64`。
- API 和 Redis 只允许通过 Compose 内部网络访问。
- 公网入口必须使用 HTTPS，并在宿主机反向代理或云负载均衡器终止 TLS。
- 房间状态保存在 API 单实例内存，API 重启会销毁所有房间。
- 文件存储目录是专用临时目录，API 启动时会清理其中全部内容。

## 启动

准备至少25 GB可用磁盘空间。默认全局文件安全上限为20,000,000,000字节，额外空间用于上传临时文件、容器层和系统日志。

```bash
export DROPROOM_CORS_ORIGINS=https://drop.example.com
export DROPROOM_IMAGE_TAG=1.2.3
pnpm docker:prod:up
```

生产 Compose 默认只把 Web 绑定到宿主机 `127.0.0.1:48080`，供同机反向代理访问。如果使用外部负载均衡器，可以显式设置：

```bash
export DROPROOM_WEB_BIND=0.0.0.0
```

不要将 API 的43117端口或 Redis 的6379端口发布到公网。

## HTTPS 与外层反向代理

外层反向代理只需要将公开域名转发到 Web 的48080端口。必须满足：

- 自动续期有效 TLS 证书。
- HTTP 永久跳转 HTTPS。
- 单请求体上限不低于3,000,000字节。
- 上传发送超时不低于5分钟。
- SSE 读取超时不低于24小时并关闭响应缓冲。
- 保留 `X-Forwarded-For`、`X-Forwarded-Proto` 和请求 ID。
- 最外层代理需要覆盖客户端自行提供的 `X-Forwarded-For`，避免伪造来源地址。
- 允许 Web 携带每个房间独立的 HttpOnly Cookie。

Web 容器内的 Nginx 已配置3 MB请求体、分片上传超时、SSE、同源 `/api` 代理和基础安全响应头。Nginx 会把外层代理提供的 `X-Forwarded-For` 继续追加到代理链，并保留外层的 HTTPS 协议。外层代理仍需采用相同或更宽松的请求限制。

## 静态资源缓存

- Vite 按路由拆分业务代码并生成内容哈希资源，未访问的房间页面代码不会在首页提前下载。
- `/assets/` 响应使用一年强缓存，内容不变时即使重新构建 Docker 镜像也可复用浏览器缓存。
- `index.html` 不使用长期缓存，确保新版本发布后浏览器能够获取最新资源清单。
- 外层反向代理或 CDN 不得覆盖上述缓存策略，也不得长期缓存 `index.html`。

## 生产变量

| 变量                            | 默认值/建议值   | 说明                                     |
| ------------------------------- | --------------- | ---------------------------------------- |
| `DROPROOM_CORS_ORIGINS`         | 公网 HTTPS 来源 | 必填，多个来源以逗号分隔                 |
| `DROPROOM_IMAGE_TAG`            | 固定版本号      | 避免生产环境直接跟随 `latest`            |
| `DROPROOM_WEB_BIND`             | `127.0.0.1`     | 外部负载均衡器场景才改为 `0.0.0.0`       |
| `DROPROOM_WEB_PORT`             | `48080`         | 宿主机内部入口                           |
| `DROPROOM_ROOM_LIFETIME_MS`     | `86400000`      | 房间最长存续24小时                       |
| `DROPROOM_DISCONNECT_GRACE_MS`  | `300000`        | 离线成员和空房保留5分钟                  |
| `DROPROOM_MAX_MEMBERS_PER_ROOM` | `9`             | 单房间成员上限                           |
| `DROPROOM_MAX_TEXT_LENGTH`      | `20000`         | 单条文字字符上限                         |
| `DROPROOM_MAX_FILES_PER_BATCH`  | `50`            | 单批文件数量上限                         |
| `DROPROOM_MAX_BATCH_BYTES`      | `500000000`     | 单批文件总大小上限                       |
| `DROPROOM_MAX_ROOM_FILE_BYTES`  | `2000000000`    | 单房间文件容量上限                       |
| `DROPROOM_GLOBAL_FILE_BYTES`    | `20000000000`   | 全局文件容量上限，必须小于存储卷可用空间 |
| `DROPROOM_OPENAPI_ENABLED`      | `false`         | 生产默认关闭接口文档                     |
| `DROPROOM_LOG_LEVEL`            | `info`          | 故障排查时临时调整                       |

容量必须满足“单批文件上限 ≤ 单房间文件上限 ≤ 全局文件上限”，API 会在启动时拒绝不一致的配置。房间快照会把文字、批次和房间容量限制下发给 Web，前端无需同步修改常量。

## 上线检查

1. `docker compose -f compose.production.yaml config` 能够成功展开。
2. Web、API、Redis 三个容器均为 healthy。
3. HTTP 会跳转到 HTTPS。
4. `/health` 通过 Web 的 `/api/health` 返回成功。
5. 创建两个设备的测试房间，完成文字、上传、预览和下载。
6. 检查 SSE、预览和下载 URL，确认没有成员 token。
7. 验证接近500 MB的文件可以通过多个分片完成上传。
8. 验证容器重启策略和宿主机开机自启。

## 监控与告警

一期不在应用内引入独立指标系统，使用容器、主机和结构化日志监控即可。至少配置：

| 指标                           | 告警建议                         |
| ------------------------------ | -------------------------------- |
| Web、API 或 Redis 健康检查失败 | 持续2分钟告警                    |
| API 容器重启                   | 每次告警，因为重启会销毁全部房间 |
| 存储卷使用率                   | 70%预警，85%严重                 |
| 存储卷可用空间                 | 小于5 GB严重                     |
| API 5xx比例                    | 5分钟内超过1%告警                |
| API 429数量                    | 突增时检查枚举或批量创建         |
| API 请求耗时                   | p95持续超过2秒时排查             |
| 主机出口带宽                   | 持续接近供应商上限时告警         |
| Redis 不可用                   | 立即告警                         |

API 使用 Pino 输出请求方法、路径、状态码、耗时和请求 ID。日志平台应按 `statusCode`、`durationMs` 和错误码聚合；不要采集 URL 查询参数。

## 临时文件清理

正常情况下，房间销毁和 API 启动会自动清理文件。不要在 API 运行时直接删除存储卷中的单个文件，否则内存状态与磁盘状态会不一致。

磁盘异常增长时：

1. 确认是否有接近全局容量上限的正常流量。
2. 保存 API 日志和容器状态用于排查。
3. 通知在线用户服务将中断。
4. 重启 API；这会销毁所有房间并清理临时目录。
5. 如果卷仍异常，停止整套服务，删除并重建专用存储卷后再启动。

```bash
docker compose -f compose.production.yaml restart api
```

彻底重建会永久删除所有临时房间和 Redis 限流窗口：

```bash
docker compose -f compose.production.yaml down --volumes
pnpm docker:prod:up
```

`down --volumes` 只能用于确认允许全部临时数据丢失的紧急处理。

## 升级与回滚

升级前固定镜像版本并确认 CI 全部通过：

```bash
DROPROOM_IMAGE_TAG=1.2.3 pnpm docker:prod:up
```

由于房间状态不跨 API 进程保存，任何升级和回滚都会中断现有房间。应选择低峰期并提前公告。回滚时将 `DROPROOM_IMAGE_TAG` 改回上一个已验证版本重新启动。
