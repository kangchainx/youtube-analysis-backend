# YouTube Analysis Backend

基于 Node.js + TypeScript 的后端服务，为 YouTube 数据分析与视频转写应用提供 API。后端内置用户认证、通知推送、对象存储、数据库持久化，并通过签名鉴权安全地代理 Python fast‑whisper 转写服务。

> 如果这个项目对你有帮助，请点亮一个 ⭐️，你的支持是我持续改进的动力。

## 功能亮点
- **安全认证**：Google OAuth 2.0 + JWT 会话，统一的登录态中间件。
- **视频转写**：对接 Python fast‑whisper，支持任务创建、状态查询、SSE 实时进度、结果下载（签名鉴权头防止前端直连）。
- **通知中心**：转写任务完成/失败自动生成未读通知，支持 SSE 推送与批量/单条已读。
- **YouTube 数据**：拉取并持久化频道、视频、播放列表数据，支持 Spotlight/订阅同步任务。
- **对象存储**：MinIO/S3 兼容的结果文件签名下载。
- **完善日志**：Winston 按文件/控制台分级输出，便于生产排障。

## 快速开始
```bash
npm install
cp .env.example .env   # 填好必须的密钥/连接信息
npm run dev            # http://localhost:5001
```

Docker 构建与运行：
```bash
docker build -t youtube-analysis-backend .
docker run -d --name youtube-analysis-backend -p 5001:5001 --env-file .env youtube-analysis-backend
```

## 关键接口（全部前缀 `/api`）
- **健康检查**：`GET /health`
- **认证**：`/auth/*`（Google OAuth、登录、登出）
- **视频转写（需登录）**：前缀 `/video-translate`
  - `POST /video-translate/tasks` 创建任务
  - `GET /video-translate/tasks` / `tasks/details` 分页查询（含文件明细）
  - `GET /video-translate/tasks/:taskId` 状态与文件列表
  - `GET /video-translate/tasks/:taskId/stream` SSE 实时进度
  - `GET /video-translate/tasks/:taskId/download-url` 获取签名下载地址
  - `GET /video-translate/status` 转写服务健康检查
- **通知（需登录）**：`GET /notifications`、`POST /notifications/:id/mark-read`、`POST /notifications/mark-all-read`、`GET /notifications/stream`
- **YouTube 数据**：`/youtube/*`（频道、视频、播放列表、订阅同步等）
- **导出**：`/export/*`（CSV/Excel）

## 环境变量说明
复制 `.env.example` 后按需填写，核心项：

### 基础 & 认证
- `PORT`：服务端口（默认 5001）
- `CLIENT_ORIGIN`：允许的前端来源（CORS）
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` / `GOOGLE_AUTH_SCOPES`
- `JWT_SECRET` / `JWT_EXPIRES_IN`
- `SESSION_COOKIE_NAME` / `SESSION_COOKIE_SECURE` / `SESSION_COOKIE_SAMESITE`

### 数据库 & 存储
- `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME`
- `MINIO_ENDPOINT` / `MINIO_PORT` / `MINIO_USE_SSL` / `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` / `MINIO_BUCKET` / `MINIO_REGION` / `MINIO_PRESIGN_EXPIRY_SECONDS`

### 视频转写（Python fast‑whisper 服务）
- `VIDEO_TRANSLATE_SERVICE_BASE_URL`：Python 服务地址
- `VIDEO_TRANSLATE_STREAM_TIMEOUT_MS`：SSE 超时（默认 15 分钟）
- `VIDEO_TRANSLATE_DEFAULT_MODEL` / `VIDEO_TRANSLATE_DEFAULT_DEVICE` / `VIDEO_TRANSLATE_DEFAULT_COMPUTE_TYPE`：默认模型/设备/算力
- `VIDEO_TRANSLATE_SHARED_SECRET`：Node 与 Python 共享的签名密钥（用于鉴权头 `X-Auth-*`）

### 其他
- `YOUTUBE_API_KEY` / `SPOTLIGHT_CHANNEL_HANDLES`
- 日志相关：`LOG_LEVEL` / `LOG_CONSOLE_LEVEL` / `LOG_FILE_LEVEL` / `LOG_DIR` / `LOG_FILE_NAME` / `LOG_MAX_SIZE_MB` / `LOG_MAX_FILES`
- `ENABLE_FETCH_PROXY`：是否启用 fetch 代理

## 可用脚本
- `npm run dev`：开发热重载
- `npm run build`：编译到 `dist/`
- `npm start`：运行编译产物
- `npm run sync:spotlight` / `sync:spotlight:prod`：同步 Spotlight 频道
- `npm run sync:subscriptions` / `sync:subscriptions:prod`：同步订阅频道

## 项目结构
```
src/
  app.ts                # Express 应用工厂
  server.ts             # HTTP 入口
  config/env.ts         # 环境变量解析
  middleware/           # 鉴权、错误等中间件
  routes/               # 路由（auth、notifications、video-translate、youtube 等）
  services/             # 业务服务（session、YouTube、转写、通知等）
  database/             # PG 连接池
  utils/                # 工具（日志、错误、时间等）
```

## 开发者须知
- 所有业务接口默认前缀 `/api`，需登录的接口已统一挂载 `requireAuth`。
- 视频转写调用 Python 服务时会自动附加签名头（`X-Auth-UserId`、`X-Auth-Timestamp`、`X-Auth-Nonce`、`X-Auth-Sign`），请确保 Python 端使用相同密钥与秒级时间戳校验。
- 通知：转写任务完成/失败会自动写入通知表，并可通过 `GET /notifications` 或 SSE 获取。

---

如果你觉得这个项目有价值，请给个 ⭐️。也欢迎 Issue/PR，一起完善！
