# Google OAuth 快速设置指南

## ✅ 完成状态

- [x] 前端 Google 登录按钮
- [x] 前端 OAuth 回调页面
- [x] 后端 OAuth 路由实现
- [x] CORS 配置
- [x] 数据库表结构

## 📋 设置步骤

### 1. 确认 .env 文件配置

确保 `backend/.env` 包含以下内容：

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key
SUPABASE_ANON_KEY=your_anon_key

# Google OAuth (你已经配置好的)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://127.0.0.1:8000/auth/google/callback

# JWT Secret (建议修改为随机字符串)
JWT_SECRET_KEY=your-super-secret-key-change-this

# Frontend URL
FRONTEND_URL=http://localhost:5173
```

### 2. 在 Supabase 创建数据库表

1. 登录到你的 [Supabase Dashboard](https://app.supabase.com/)
2. 选择你的项目
3. 点击左侧的 "SQL Editor"
4. 创建新查询，复制 `backend/database_setup.sql` 的内容
5. 点击 "Run" 执行

或者使用命令行：
```bash
# 查看 SQL 文件
cat backend/database_setup.sql
```

### 3. 在 Google Console 配置 OAuth

**重要**: 确保在 Google Cloud Console 中添加了正确的重定向 URI：

#### 开发环境
- **Authorized JavaScript origins**:
  - `http://localhost:5173`
  - `http://127.0.0.1:5173`

- **Authorized redirect URIs**:
  - `http://localhost:5173/auth/callback`
  - `http://127.0.0.1:8000/auth/google/callback`

#### 配置步骤
1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 选择你的项目
3. 导航到 "APIs & Services" > "Credentials"
4. 点击你的 OAuth 2.0 Client ID
5. 在 "Authorized redirect URIs" 部分，添加上述 URL
6. 保存

### 4. 启动应用

#### 启动后端
```bash
cd backend
uvicorn app.main:app --reload
```

后端将运行在 `http://127.0.0.1:8000`

#### 启动前端
```bash
cd frontend
npm run dev
```

前端将运行在 `http://localhost:5173`

### 5. 测试 OAuth 登录

1. 打开浏览器访问 `http://localhost:5173/login`
2. 点击 "Sign in with Google" 按钮
3. 选择 Google 账户登录
4. 授权后应该自动重定向回应用并登录成功

## 🔍 测试 API 端点

### 查看 API 文档
访问 `http://127.0.0.1:8000/docs` 查看所有可用的 API 端点。

### 主要端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/auth/google/login` | GET | 启动 Google OAuth 流程 |
| `/auth/google/callback` | GET | Google OAuth 回调 |
| `/auth/login` | POST | 邮箱密码登录 |
| `/auth/signup` | POST | 用户注册 |
| `/auth/me` | GET | 获取当前用户信息 |
| `/health/supabase` | GET | 检查 Supabase 连接 |

### 测试示例

#### 1. 测试健康检查
```bash
curl http://127.0.0.1:8000/health/supabase
```

应该返回：
```json
{"ok": true, "supabase": "connected"}
```

#### 2. 测试 Google OAuth URL
```bash
curl http://127.0.0.1:8000/auth/google/login
```

应该返回包含 Google 授权 URL 的 JSON：
```json
{
  "url": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

#### 3. 测试注册（在前端完成后）
前端会自动调用这些 API。

## 🎨 前端页面

### 登录页面
- **URL**: `http://localhost:5173/login`
- **功能**:
  - 邮箱密码登录
  - Google OAuth 登录
  - 密码可见/隐藏切换
  - 表单验证

### 注册页面
- **URL**: `http://localhost:5173/signup`
- **功能**:
  - 用户注册表单
  - Google OAuth 注册
  - 密码强度指示器
  - 条款同意复选框

### OAuth 回调页面
- **URL**: `http://localhost:5173/auth/callback`
- **功能**:
  - 处理 OAuth 回调
  - 显示加载状态
  - 成功/失败提示
  - 自动重定向

## 🔧 故障排除

### 问题 1: "redirect_uri_mismatch"

**原因**: Google Console 中的重定向 URI 与代码不匹配

**解决**:
1. 检查 Google Console 中的 "Authorized redirect URIs"
2. 确保包含: `http://127.0.0.1:8000/auth/google/callback`
3. 注意端口和协议必须完全匹配

### 问题 2: CORS 错误

**症状**: 浏览器控制台显示 CORS 错误

**解决**:
- 后端已配置 CORS，支持 `http://localhost:5173`
- 如果仍有问题，检查 `backend/app/main.py` 的 CORS 设置

### 问题 3: "Failed to get user info"

**原因**: Google API 返回错误

**解决**:
1. 检查 Google OAuth 范围 (scope)
2. 确认 Google+ API 已启用
3. 查看后端控制台的详细错误

### 问题 4: 数据库错误

**症状**: 500 错误，提示数据库相关问题

**解决**:
1. 确认在 Supabase 中运行了 `database_setup.sql`
2. 检查 `.env` 中的 Supabase 凭据
3. 在 Supabase Dashboard 查看表是否已创建

### 问题 5: Token 未保存

**症状**: 登录后立即退出

**解决**:
1. 打开浏览器开发者工具
2. 查看 Application > Local Storage
3. 确认 `authToken` 是否存在
4. 检查前端控制台是否有错误

## 📊 数据库表结构

### users 表
```sql
- id: UUID (主键)
- email: VARCHAR (唯一)
- name: VARCHAR
- picture: TEXT
- auth_provider: VARCHAR ('email' 或 'google')
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### user_profiles 表
```sql
- user_id: UUID (外键 -> users.id)
- skills: JSONB
- tools: JSONB
- certifications: JSONB
- work_experience: TEXT
- career_goals: TEXT
```

## 🔐 安全建议

### 开发环境
- ✅ 使用 HTTP (localhost)
- ✅ 使用测试 Google OAuth 凭据

### 生产环境（部署时）
1. **必须使用 HTTPS**
2. **更新 Google OAuth 重定向 URI** 为生产域名
3. **修改 JWT_SECRET_KEY** 为强随机字符串
4. **限制 CORS** 只允许你的前端域名
5. **启用 Supabase RLS**（Row Level Security）

生成安全的 JWT Secret:
```python
import secrets
print(secrets.token_urlsafe(32))
```

## 📝 下一步

### 立即可以做的
- [x] 测试 Google 登录
- [x] 测试注册功能
- [ ] 添加密码哈希（使用 bcrypt）
- [ ] 实现密码重置功能
- [ ] 添加邮箱验证

### 功能增强
- [ ] 支持其他 OAuth 提供商（LinkedIn, GitHub）
- [ ] 实现刷新 Token 机制
- [ ] 添加用户权限管理
- [ ] 实现会话管理

## 🎉 完成！

如果一切配置正确，你应该能够：
1. ✅ 访问登录页面
2. ✅ 点击 Google 登录按钮
3. ✅ 完成 Google 授权
4. ✅ 自动登录并重定向到 Dashboard

有任何问题，查看：
- 后端日志（终端输出）
- 前端控制台（浏览器 F12）
- Supabase 日志（Dashboard）

## 📞 调试技巧

### 查看后端日志
```bash
# 后端运行时会显示详细日志
# 包括 OAuth 流程、数据库操作等
```

### 查看前端状态
```javascript
// 在浏览器控制台运行
localStorage.getItem('authToken')
```

### 测试数据库连接
```bash
curl http://127.0.0.1:8000/health/supabase
```

祝你使用愉快！🚀

