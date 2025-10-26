# SkillBridge Frontend - Setup Guide

## 项目概述

SkillBridge 是一个 AI 驱动的职业转型平台，专为失业工人设计，帮助他们找到新的职业机会。前端使用 React + TypeScript + Vite 构建，遵循现代化的设计模式和最佳实践。

## 核心功能模块

### 1. **技能评估 (Skill Assessment)**
- 使用对话式 AI 帮助用户识别可转移技能
- 实时聊天界面，支持技能提取和标准化
- 自动构建用户技能档案

### 2. **职业匹配 (Career Match)**
- 基于用户技能推荐匹配的职业
- 显示技能差距分析
- 提供薪资、增长率和地理位置信息

### 3. **学习路径 (Learning Path)**
- 生成个性化的周计划
- 推荐免费和付费的学习资源
- 跟踪学习进度

### 4. **用户仪表盘 (Dashboard)**
- 展示用户旅程概览
- 快速访问各个功能模块
- 显示个人资料和进度

## 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **路由**: React Router DOM v7
- **UI 组件**: Ant Design + Lucide Icons
- **HTTP 客户端**: Axios
- **样式**: CSS Modules

## 项目结构

```
frontend/
├── src/
│   ├── pages/                    # 页面组件
│   │   ├── Home.tsx             # 首页（落地页）
│   │   ├── LoginPage.tsx        # 登录页
│   │   ├── SignUpPage.tsx       # 注册页
│   │   ├── Dashboard.tsx        # 用户仪表盘
│   │   ├── SkillAssessment.tsx  # 技能评估（聊天界面）
│   │   ├── CareerMatch.tsx      # 职业匹配
│   │   └── LearningPath.tsx     # 学习路径
│   ├── components/              # 可复用组件
│   ├── context/                 # React Context
│   │   └── AuthContext.tsx      # 认证上下文
│   ├── services/                # API 服务
│   │   └── api.ts              # Axios 配置
│   ├── config/                  # 配置文件
│   │   └── api.ts              # API 端点配置
│   ├── App.tsx                  # 主应用组件
│   ├── main.tsx                 # 入口文件
│   ├── App.css                  # 全局样式
│   └── index.css                # 基础样式
├── public/                      # 静态资源
├── index.html                   # HTML 模板
├── vite.config.ts              # Vite 配置
├── tsconfig.json               # TypeScript 配置
├── package.json                # 依赖配置
└── .env                        # 环境变量
```

## 快速开始

### 1. 安装依赖

```bash
cd frontend
npm install
```

### 2. 配置环境变量

创建 `.env` 文件：

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

### 3. 启动开发服务器

```bash
npm run dev
```

前端将在 `http://localhost:5173` 运行

### 4. 构建生产版本

```bash
npm run build
```

构建输出在 `dist/` 目录

## 页面路由

| 路由 | 页面 | 描述 |
|------|------|------|
| `/` | Home | 首页落地页，介绍产品功能 |
| `/login` | LoginPage | 用户登录 |
| `/signup` | SignUpPage | 用户注册 |
| `/dashboard` | Dashboard | 用户仪表盘，快速导航 |
| `/assessment` | SkillAssessment | AI 对话式技能评估 |
| `/careers` | CareerMatch | 职业匹配和技能差距分析 |
| `/learning` | LearningPath | 个性化学习路径规划 |

## 设计特色

### 1. **现代化 UI**
- 使用渐变色和动画效果
- 响应式设计，支持移动端
- 统一的颜色方案（紫色系主题）

### 2. **用户体验**
- 流畅的页面过渡
- 直观的导航结构
- 清晰的视觉层次

### 3. **可访问性**
- 语义化 HTML
- 键盘导航支持
- 合适的对比度

## API 集成

前端通过 Axios 与后端通信，主要 API 端点：

### 认证
- `POST /auth/login` - 用户登录
- `POST /auth/signup` - 用户注册
- `POST /auth/logout` - 用户登出

### 技能评估
- `POST /skills/assess` - 对话式技能评估
- `GET /skills/profile` - 获取技能档案

### 职业匹配
- `GET /careers/match` - 获取匹配的职业
- `GET /careers/recommendations` - 职业推荐

### 学习路径
- `POST /learning/path` - 生成学习路径
- `GET /learning/resources` - 获取学习资源

### 用户
- `GET /user/profile` - 获取用户资料
- `GET /user/dashboard` - 获取仪表盘数据

## 开发提示

### Mock 数据
目前部分页面使用了 mock 数据以支持独立开发。当后端 API 就绪后，可以直接替换。

### 样式管理
- 每个页面组件都有对应的 CSS Module
- 全局样式在 `App.css` 和 `index.css`
- 使用 CSS 变量可以统一主题色

### 状态管理
- 使用 React Context 进行认证状态管理
- 可以根据需要添加更多 Context（如技能档案、学习进度等）

## 下一步开发建议

1. **后端集成**
   - 连接真实的后端 API
   - 处理错误和加载状态
   - 添加数据验证

2. **功能增强**
   - 添加用户设置页面
   - 实现简历上传和解析
   - 添加学习进度跟踪

3. **性能优化**
   - 实现代码分割
   - 添加图片懒加载
   - 优化包大小

4. **测试**
   - 添加单元测试
   - 集成测试
   - E2E 测试

## 部署

### Vercel 部署

```bash
npm run build
vercel --prod
```

### Netlify 部署

```bash
npm run build
netlify deploy --prod --dir=dist
```

### Docker 部署

创建 `Dockerfile`:

```dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

MIT

## 联系方式

如有问题，请提交 Issue 或联系项目维护者。

