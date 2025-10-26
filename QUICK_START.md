# SkillBridge - Quick Start Guide

快速启动 SkillBridge 前后端开发环境。

## 📋 前置要求

### 后端
- Python 3.9+ （你目前使用的是 3.9）
- pip

### 前端
- Node.js 14+
- npm

## 🚀 快速启动步骤

### 1. 后端启动

打开第一个终端窗口：

```bash
# 进入后端目录
cd /Users/jinhonglin/Desktop/grad2career/backend

# 激活虚拟环境（如果有的话）
# source venv/bin/activate

# 安装依赖（如果还没安装）
pip install -r requirements.txt

# 启动后端服务器
uvicorn app.main:app --reload
```

✅ 后端将运行在：`http://127.0.0.1:8000`

测试后端健康检查：
```bash
curl http://127.0.0.1:8000/health/supabase
```

### 2. 前端启动

打开第二个终端窗口：

```bash
# 进入前端目录
cd /Users/jinhonglin/Desktop/grad2career/frontend

# 安装依赖（如果还没安装）
npm install

# 启动前端开发服务器
npm run dev
```

✅ 前端将运行在：`http://localhost:5173`

在浏览器中打开 `http://localhost:5173` 查看应用。

## 📁 项目结构概览

```
grad2career/
├── backend/              # FastAPI 后端
│   ├── app/
│   │   ├── main.py      # 后端入口
│   │   ├── api/         # API 路由
│   │   ├── core/        # 核心配置
│   │   └── db/          # 数据库模型
│   └── requirements.txt
│
└── frontend/            # React 前端
    ├── src/
    │   ├── pages/       # 页面组件
    │   ├── App.tsx      # 主应用
    │   └── main.tsx     # 前端入口
    └── package.json
```

## 🎯 功能页面导航

### 主要页面路由

| URL | 页面 | 功能 |
|-----|------|------|
| `/` | 首页 | 产品介绍和登陆入口 |
| `/signup` | 注册 | 创建新账户 |
| `/login` | 登录 | 用户登录 |
| `/dashboard` | 仪表盘 | 用户概览和快速导航 |
| `/assessment` | 技能评估 | AI 对话式技能识别 |
| `/careers` | 职业匹配 | 查看匹配的职业机会 |
| `/learning` | 学习路径 | 个性化培训计划 |

## 🔧 开发工具

### 后端 API 文档

访问自动生成的 API 文档：
- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

### 前端开发工具

- ESLint: 代码检查
  ```bash
  cd frontend && npm run lint
  ```

- 构建生产版本
  ```bash
  cd frontend && npm run build
  ```

## ⚙️ 环境变量配置

### 后端 (.env)

在 `backend/.env` 文件中配置：

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key
SUPABASE_ANON_KEY=your_anon_key
```

### 前端 (.env)

在 `frontend/.env` 文件中配置：

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## 🐛 常见问题

### 问题 1：后端依赖安装失败

**解决方案：**
```bash
# 如果使用的是 Python 3.9，确保使用兼容版本
cd backend
pip install -r requirements.txt
```

注意：`click==8.1.8` 和 `packaging==23.2` 已经针对 Python 3.9 进行了优化。

### 问题 2：前端无法连接后端

**检查项：**
1. 后端是否正在运行？访问 `http://127.0.0.1:8000/health/supabase`
2. `.env` 文件中的 `VITE_API_BASE_URL` 是否正确？
3. 浏览器控制台是否有 CORS 错误？

### 问题 3：端口被占用

**后端端口冲突：**
```bash
# 使用其他端口
uvicorn app.main:app --reload --port 8001
```

**前端端口冲突：**
```bash
# Vite 会自动选择下一个可用端口
npm run dev
```

## 📝 开发流程

### 典型的开发会话

1. **启动后端**
   ```bash
   cd backend && uvicorn app.main:app --reload
   ```

2. **启动前端**
   ```bash
   cd frontend && npm run dev
   ```

3. **开发和测试**
   - 修改前端代码，浏览器自动刷新
   - 修改后端代码，FastAPI 自动重载
   - 使用浏览器开发者工具调试

4. **提交代码**
   ```bash
   git add .
   git commit -m "你的提交信息"
   git push
   ```

## 🎨 UI 设计参考

### 颜色主题

- **主色调：** 紫色渐变 (#667eea → #764ba2)
- **成功：** 绿色 (#10b981)
- **警告：** 黄色 (#f59e0b)
- **错误：** 红色 (#ef4444)

### 组件库

- Ant Design (antd)
- Lucide Icons

## 📚 下一步

1. **后端开发**
   - 实现 AI 技能提取模块
   - 集成 OpenAI API
   - 连接 Supabase 数据库

2. **前端开发**
   - 优化用户体验
   - 添加更多交互功能
   - 实现进度跟踪

3. **测试**
   - 编写单元测试
   - 集成测试
   - E2E 测试

4. **部署**
   - 部署后端到 Render/Railway
   - 部署前端到 Vercel/Netlify

## 💡 有用的命令

### 后端

```bash
# 查看所有路由
uvicorn app.main:app --reload --log-level debug

# 运行测试
pytest

# 检查代码格式
black app/
flake8 app/
```

### 前端

```bash
# 安装新依赖
npm install package-name

# 构建
npm run build

# 预览构建
npm run preview

# 检查 linter
npm run lint
```

## 🤝 获取帮助

- 查看 `README.md` 了解项目概览
- 查看 `FRONTEND_SETUP.md` 了解前端详细文档
- 遇到问题请查看终端错误信息
- 使用浏览器开发者工具调试前端问题

---

**祝你开发愉快！🚀**

