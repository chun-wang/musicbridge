# AGENTS.md

本文件用于指导在 `music_connect` 工程中创建和维护一个服务端（后端）应用。任何 AI 助手或开发者都应遵守本文档中的约定。

## 项目概述

- 语言：TypeScript（严格模式）
- 运行时：Node.js（LTS 版本，建议 20+）
- 目标：提供一个简单的 RESTful API 服务端
- 部署：支持打包为 Docker 镜像运行
- 目录：本工程即服务端工程根目录（当前仓库仅包含后端）

## 技术选型

| 用途       | 选择                    |
| ---------- | ----------------------- |
| Web 框架   | Express（轻量、简单）   |
| 运行时     | Node.js + tsx/ts-node   |
| 构建       | tsc 编译到 `dist/`      |
| 校验       | zod（请求/环境变量校验）|
| 日志       | pino（结构化日志）      |
| 环境变量   | dotenv                  |

## 目录结构约定

新建代码时必须遵循以下结构：

```
music_connect/
├── src/
│   ├── index.ts          # 应用入口，启动 HTTP 服务
│   ├── app.ts            # 组装 Express 应用（路由、中间件）
│   ├── routes/           # 路由定义，每个资源一个文件
│   │   └── <resource>.ts
│   ├── controllers/      # 请求处理逻辑
│   │   └── <resource>.ts
│   ├── services/         # 业务逻辑层
│   │   └── <resource>.ts
│   ├── middlewares/      # 自定义中间件（错误处理、鉴权等）
│   ├── config/           # 配置加载与环境变量校验
│   └── types/            # 共享的 TypeScript 类型
├── html/                 # 静态页面，通过 express.static 提供浏览
│   └── index.html
├── music/                # 歌曲下载目录（运行时生成，gitignore）
├── test/                 # 单元/集成测试
├── dist/                 # tsc 构建产物（不要手改，gitignore）
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

## 常用命令

```bash
npm install          # 安装依赖
npm run dev          # 开发模式（热重载）
npm run build        # 编译 TypeScript 到 dist/
npm run start        # 运行编译后的产物
npm run lint         # 代码检查
npm test             # 运行测试
```

## RESTful 设计约定

- 使用名词复数形式作为资源路径：`GET /api/items`、`GET /api/items/:id`、`POST /api/items`、`PUT /api/items/:id`、`DELETE /api/items/:id`
- 所有 API 统一挂载在 `/api` 前缀下
- 统一响应格式：

```json
{ "data": { ... } }             // 成功
{ "error": { "code": 400, "message": "..." } }   // 失败
```

- 错误处理统一通过错误处理中间件（`src/middlewares/errorHandler.ts`）输出，不要在各路由中重复 try/catch
- 请求参数必须用 zod 校验，非法参数返回 `400` 与明确错误信息
- 使用 `pino` 记录请求日志（方法、路径、状态码、耗时），不要在代码里手写 `console.log`

## 代码风格

- 使用 ESLint + Prettier，遵循 Airbnb 或 Standard 风格（在仓库中统一一种）
- 接口类型使用 `interface`，其余类型使用 `type`
- 函数命名：动词开头（`getItemById`、`createItem`）
- 变量命名：`camelCase`；常量：`UPPER_SNAKE_CASE`
- 文件命名：`kebab-case`
- 不要添加无意义的注释；只在解释"为什么"时写注释
- 所有可配置项（端口、DB 地址、密钥等）从环境变量读取，并在 `src/config/` 中用 zod 做启动时校验

## Docker 打包

使用多阶段构建，目标镜像使用精简运行镜像。

```bash
docker build -t music-connect-server .
docker run -p 3000:3000 music-connect-server
```

或使用 docker-compose：

```bash
docker compose up --build
```

### Dockerfile 要点

- 阶段一（builder）：`node:20-alpine`，`npm ci` 后 `npm run build`
- 阶段二（runtime）：`node:20-alpine`，`apk add ffmpeg`，只拷贝 `dist/`、`package.json`、`package-lock.json`，执行 `npm ci --omit=dev`
- 使用非 root 用户运行
- `EXPOSE` 服务端口（默认 3000）
- 健康检查可用 `HEALTHCHECK`（指向一个 `GET /health` 端点）

### ffmpeg 依赖

- 元数据嵌入（歌词/封面/标题等）通过调用 `ffmpeg` 二进制实现（`src/services/tags.ts`）
- 通过环境变量 `FFMPEG_PATH` 指定 ffmpeg 路径（默认 `ffmpeg`，即依赖 PATH）
- 本地开发若 ffmpeg 不在 PATH，在 `.env` 中设置 `FFMPEG_PATH`（如 `C:\...\ffmpeg.exe`）
- Docker 镜像已内置 ffmpeg，无需额外配置

## 测试约定

- 使用 Vitest + Supertest 做集成测试
- 每个 controller/service 至少有一个测试
- 测试不依赖外部服务；涉及数据库时使用 mock 或内存实现

## 完成任务的检查清单

1. `npm run lint` 无报错
2. `npm run build` 编译通过
3. `npm test` 全部通过
4. `docker build` 能成功构建镜像
5. 本地 `npm run dev` 后 `curl http://localhost:3000/health` 返回 200
