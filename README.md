# 记忆花园 Memory Garden

> 你的个人第二大脑——任务管理 + 知识库 + 抗遗忘系统

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，设置 DATABASE_URL、OWNER_PASSWORD

# 3. 初始化数据库
npm run db:push

# 4. 导入演示数据（可选）
npm run db:seed

# 5. 启动开发服务器
npm run dev
```

访问 http://localhost:3000，默认密码：`memory2024`（在 .env 中修改）

## 技术栈

- **Next.js 16** (App Router) + TypeScript
- **Prisma 7** + PostgreSQL
- **Tailwind CSS v4** + shadcn/ui 自实现组件
- **framer-motion** 动效
- **date-fns** 日期处理
- **Zod** 数据校验

## 功能页面

| 路由 | 功能 |
|------|------|
| `/today` | 今日行动中心（逾期/今日/未来7天/待复习） |
| `/inbox` | 快速收件箱，转为任务或笔记 |
| `/tasks` | 任务列表（筛选/搜索/优先级/标签） |
| `/timeline` | 时间线（周/月视图，桌面+手机自适应） |
| `/notes` | 知识库列表 |
| `/notes/new` | 新建笔记（Markdown 编辑 + 预览） |
| `/notes/:id` | 笔记详情 + 间隔复习操作 |
| `/review` | 知识复习（忘了/模糊/记得/很熟） |
| `/tags` | 标签管理 |
| `/tags/:slug` | 标签详情页 |
| `/search` | 全局搜索（任务+笔记+标签） |
| `/settings` | 主题/安全/数据 |

## 数据库管理

```bash
npm run db:push     # 推送 schema 变更（开发用）
npm run db:migrate  # 创建迁移（生产推荐）
npm run db:seed     # 导入演示数据
npm run db:studio   # 打开 Prisma Studio
```

## 部署

1. 确保设置安全的 `OWNER_PASSWORD` 和 `SESSION_SECRET`
2. 配置 PostgreSQL 生产数据库
3. `npm run build && npm run start`
# 2nd_memory
