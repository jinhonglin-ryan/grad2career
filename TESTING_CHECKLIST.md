# ✅ Google OAuth 测试清单

## 🚀 服务器状态

### ✅ 后端已启动
```bash
# 后端运行在: http://127.0.0.1:8000
# 状态: ✅ 正常运行
# Supabase 连接: ✅ 已连接
# OAuth 端点: ✅ 工作正常
```

### ⏳ 前端启动
```bash
cd /Users/jinhonglin/Desktop/grad2career/frontend
npm run dev
# 将运行在: http://localhost:5173
```

## 📋 测试步骤

### 第 1 步: 创建数据库表 ⚠️ 重要

在 Supabase 中运行以下 SQL:

1. 登录 [Supabase Dashboard](https://app.supabase.com/)
2. 选择你的项目
3. 点击左侧 "SQL Editor"
4. 点击 "New Query"
5. 复制粘贴 `backend/database_setup.sql` 的内容
6. 点击 "Run" 执行

**快速验证**:
```sql
-- 在 SQL Editor 中运行
SELECT * FROM users;
-- 应该返回空表（没有错误）
```

### 第 2 步: 验证后端 API

#### ✅ 健康检查
```bash
curl http://127.0.0.1:8000/health/supabase
```
**预期结果**:
```json
{"ok":true,"supabase":"connected"}
```

#### ✅ Google OAuth URL
```bash
curl http://127.0.0.1:8000/auth/google/login
```
**预期结果**:
```json
{
  "url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=..."
}
```

#### 📖 查看 API 文档
浏览器访问: `http://127.0.0.1:8000/docs`

### 第 3 步: 测试前端登录

#### 方式 1: Google OAuth 登录

1. **访问登录页面**
   ```
   http://localhost:5173/login
   ```

2. **点击 "Sign in with Google" 按钮**
   - 应该重定向到 Google 登录页面

3. **选择 Google 账户并授权**
   - 允许访问邮箱和基本信息

4. **自动重定向**
   - 回到应用的 `/auth/callback` 页面
   - 显示 "Login successful! Redirecting..."
   - 自动跳转到 `/dashboard`

5. **验证登录状态**
   - 打开浏览器开发者工具 (F12)
   - 进入 Application > Local Storage
   - 查看 `authToken` 是否存在

#### 方式 2: 邮箱密码注册（可选）

1. **访问注册页面**
   ```
   http://localhost:5173/signup
   ```

2. **填写注册表单**
   - 姓名: Test User
   - 邮箱: test@example.com
   - 密码: 至少 6 位
   - 确认密码

3. **点击 "Create Account"**
   - 应该创建账户并跳转到 `/assessment`

### 第 4 步: 验证数据库记录

在 Supabase SQL Editor 中:

```sql
-- 查看创建的用户
SELECT * FROM users;

-- 应该看到你的 Google 账户信息
-- 包括: email, name, picture, auth_provider='google'
```

## 🎯 UI/UX 测试清单

### 登录页面 (`/login`)
- [ ] 页面加载正常
- [ ] 左侧表单 + 右侧推荐语显示
- [ ] **输入框文字清晰可见** ✨
- [ ] 邮箱输入框有图标
- [ ] 密码输入框有图标
- [ ] 眼睛图标可以切换密码显示/隐藏
- [ ] Google 按钮显示 Google 图标
- [ ] "Forgot password" 链接可见
- [ ] "Sign up" 链接正常跳转
- [ ] "Back to Home" 返回首页

### 注册页面 (`/signup`)
- [ ] 页面加载正常
- [ ] Google 按钮在最上方
- [ ] 分隔线 "or sign up with email" 清晰
- [ ] 所有输入框有对应图标
- [ ] 密码强度指示器工作
- [ ] 确认密码验证
- [ ] 条款同意复选框
- [ ] 统计数据显示（5,000+, 92%, 100+）
- [ ] "Log in" 链接正常跳转

### OAuth 回调页面 (`/auth/callback`)
- [ ] 加载动画显示
- [ ] 成功时显示绿色对勾
- [ ] 失败时显示红色叉号
- [ ] 消息清晰易读
- [ ] 自动重定向

## 🐛 常见问题检查

### ❌ 如果看不到输入的文字
**已修复** ✅ - 输入框添加了 `color: #1f2937`

### ❌ 如果 Google 按钮点击无反应
**检查**:
1. 打开浏览器控制台 (F12)
2. 查看是否有错误
3. 确认后端正在运行
4. 测试 API: `curl http://127.0.0.1:8000/auth/google/login`

### ❌ 如果出现 redirect_uri_mismatch
**解决**:
1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. APIs & Services > Credentials
3. 选择你的 OAuth Client ID
4. 在 "Authorized redirect URIs" 添加:
   - `http://127.0.0.1:8000/auth/google/callback`
5. 保存

### ❌ 如果回调后显示错误
**检查**:
1. 查看 URL 中的错误参数: `?error=...`
2. 检查后端终端日志
3. 确认数据库表已创建
4. 验证 `.env` 配置正确

### ❌ 如果 Token 未保存
**检查**:
1. 浏览器控制台是否有错误
2. Application > Local Storage 是否允许
3. 是否在隐私模式（可能阻止 localStorage）

## 📊 验证完整流程

### 成功的登录流程应该是:

1. ✅ 点击 "Sign in with Google"
2. ✅ 重定向到 Google 登录页
3. ✅ 选择账户并授权
4. ✅ 重定向到 `http://127.0.0.1:8000/auth/google/callback?code=...`
5. ✅ 后端处理并重定向到 `http://localhost:5173/auth/callback?token=...`
6. ✅ 前端保存 Token 到 localStorage
7. ✅ 显示成功消息
8. ✅ 自动跳转到 `/dashboard`

### 在每一步你应该看到:

**Step 1-2**: Google 登录页面
**Step 3-4**: 浏览器地址栏快速变化
**Step 5**: 前端回调页面，显示加载动画
**Step 6**: 显示 "Login successful!"
**Step 7**: 跳转到 Dashboard

## 🎉 全部通过的标志

- [x] 后端健康检查返回 OK
- [x] Google OAuth URL 正常生成
- [ ] 数据库表创建成功
- [ ] 前端页面正常显示
- [ ] 输入框文字清晰可见
- [ ] Google 登录流程完整
- [ ] Token 成功保存
- [ ] Dashboard 显示用户信息

## 🔍 调试命令

```bash
# 检查后端健康
curl http://127.0.0.1:8000/health/supabase

# 获取 Google OAuth URL
curl http://127.0.0.1:8000/auth/google/login

# 查看 API 文档
open http://127.0.0.1:8000/docs

# 查看前端
open http://localhost:5173/login

# 检查 localStorage (在浏览器控制台)
localStorage.getItem('authToken')
```

## 📝 下一步

完成测试后:
1. [ ] 在 Supabase 添加示例数据
2. [ ] 实现密码哈希
3. [ ] 添加更多测试用例
4. [ ] 部署到生产环境

---

**当前状态**: ✅ 后端运行中，等待测试

需要帮助？查看:
- `GOOGLE_OAUTH_GUIDE.md` - 详细设置
- `OAUTH_IMPLEMENTATION_SUMMARY.md` - 实现总结
- 后端日志 - 终端输出
- 前端控制台 - 浏览器 F12

