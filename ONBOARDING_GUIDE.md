# 用户 Onboarding 流程指南

## 🎯 功能概述

新增了完整的用户信息收集（Onboarding）流程，在用户通过 Google OAuth 首次登录后，会引导他们填写详细的个人信息，包括：
- 工作经验
- 技能
- 证书
- 职业目标

## 📋 流程说明

### 1. OAuth 登录流程

```
用户点击 "Sign in with Google"
    ↓
Google 授权
    ↓
后端检查用户状态
    ↓
判断：是否为新用户？
    ├─ 是 → 跳转到 /onboarding
    └─ 否 → 跳转到 /dashboard
```

### 2. Onboarding 页面步骤

#### Step 1: Basic Information (基本信息)
- 当前/最近的职位
- 工作年限
- 行业
- 所在地

#### Step 2: Skills & Experience (技能与经验)
- 工作经验描述
- 技能列表（可添加多个）
- 证书列表（可选）

#### Step 3: Career Goals (职业目标)
- 职业目标描述
- 求职偏好（多选）:
  - Transition to Renewable Energy
  - Learn New Technology Skills
  - Get Industry Certification
  - Increase Salary
  - Better Work-Life Balance
  - Remote Work Opportunity

#### Step 4: Review (审核)
- 回顾所有填写的信息
- 确认无误后提交

### 3. 数据保存

完成 Onboarding 后：
1. 数据保存到 `user_profiles` 表
2. 元数据保存到 `users` 表的 `metadata` 字段
3. 自动跳转到 Dashboard

## 🎨 UI 设计特点

### 左侧进度栏
- 显示当前步骤
- 步骤完成后显示绿色对勾
- 始终可见当前进度

### 右侧表单区域
- 清晰的步骤标题和图标
- 友好的输入提示
- 实时验证
- 底部进度条

### 交互体验
- 流畅的步骤切换动画
- 智能的"Continue"按钮启用/禁用
- 标签式技能/证书添加
- 复选框式目标选择

## 🔧 技术实现

### 前端文件

#### 新增文件
```
frontend/src/pages/
├── OnboardingPage.tsx          # 主要组件
└── OnboardingPage.module.css   # 样式文件
```

#### 修改文件
```
frontend/src/
├── App.tsx                     # 添加 /onboarding 路由
└── pages/
    └── OAuthCallback.tsx       # 添加新用户检测逻辑
```

### 后端文件

#### 修改文件
```
backend/app/api/routes/
└── auth.py
    ├── google_callback()       # 添加新用户标记
    └── save_user_profile()     # 新增 API 端点
```

#### 数据库更新
```sql
-- 添加 metadata 字段到 users 表
ALTER TABLE users ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
```

## 📊 数据结构

### 前端提交数据格式

```typescript
{
  currentRole: string,
  yearsOfExperience: string,
  industry: string,
  location: string,
  skills: string[],
  workExperience: string,
  careerGoals: string,
  certifications: string[],
  lookingFor: string[]
}
```

### 后端存储格式

#### user_profiles 表
```json
{
  "user_id": "uuid",
  "skills": ["skill1", "skill2"],
  "certifications": ["cert1", "cert2"],
  "work_experience": "详细描述...",
  "career_goals": "目标描述..."
}
```

#### users 表 (metadata 字段)
```json
{
  "current_role": "Coal Miner",
  "years_of_experience": "10-20",
  "industry": "Coal Mining",
  "location": "West Virginia",
  "looking_for": ["Transition to Renewable Energy", "Learn New Technology Skills"]
}
```

## 🔄 API 端点

### POST /user/profile

**请求**:
```bash
curl -X POST http://127.0.0.1:8000/user/profile \
  -H "Content-Type: application/json" \
  -d '{
    "currentRole": "Coal Miner",
    "yearsOfExperience": "10-20",
    "industry": "Coal Mining",
    "skills": ["Heavy Equipment", "Safety Management"],
    "workExperience": "...",
    "careerGoals": "...",
    "certifications": ["MSHA"],
    "lookingFor": ["Renewable Energy"]
  }'
```

**响应**:
```json
{
  "message": "Profile saved successfully",
  "profile": { ... }
}
```

## 🚀 测试流程

### 1. 测试新用户 Onboarding

1. **清除之前的登录状态**
   ```javascript
   // 在浏览器控制台
   localStorage.clear()
   ```

2. **使用 Google OAuth 登录**
   - 访问 `http://localhost:5173/login`
   - 点击 "Sign in with Google"
   - 完成授权

3. **验证跳转到 Onboarding**
   - 应该自动跳转到 `/onboarding`
   - 看到 4 步骤进度

4. **填写信息**
   - Step 1: 填写基本信息
   - Step 2: 添加技能和经验
   - Step 3: 选择职业目标
   - Step 4: 审核并提交

5. **验证数据保存**
   - 在 Supabase 查看 `user_profiles` 表
   - 查看 `users` 表的 `metadata` 字段

### 2. 测试已有用户登录

1. **再次登录**
   - 使用相同的 Google 账户登录

2. **验证直接跳转**
   - 应该直接跳转到 `/dashboard`
   - 不会再显示 Onboarding

## 🎯 用户体验优化

### 表单验证
- **必填字段**: 标记 * 的字段必须填写
- **实时启用**: "Continue" 按钮根据必填字段自动启用/禁用
- **错误提示**: 清晰的错误消息

### 进度指示
- **步骤进度条**: 左侧显示当前进度
- **底部进度条**: 显示完成百分比
- **已完成标记**: 完成的步骤显示绿色对勾

### 数据保留
- **步骤切换**: 切换步骤时数据保留
- **返回编辑**: 可以返回上一步修改

## 📱 响应式设计

### 桌面端 (> 1024px)
- 左右分栏布局
- 左侧进度栏固定
- 右侧表单居中

### 平板端 (768px - 1024px)
- 隐藏左侧进度栏
- 表单全屏显示
- 保持所有功能

### 移动端 (< 768px)
- 单列布局
- 表单行变为单列
- 按钮全宽显示

## 🔍 调试技巧

### 查看用户状态
```javascript
// 浏览器控制台
localStorage.getItem('authToken')
localStorage.getItem('onboarding_completed')
```

### 重置 Onboarding
```javascript
// 清除完成标记，再次显示 Onboarding
localStorage.removeItem('onboarding_completed')
```

### 查看提交数据
```javascript
// 在 OnboardingPage.tsx 的 handleSubmit 中添加
console.log('Submitting data:', formData)
```

## 🐛 常见问题

### Q: 已有用户也看到 Onboarding？
**A**: 检查数据库 `user_profiles` 表，确保用户有记录

### Q: 提交后没有跳转？
**A**: 
1. 检查浏览器控制台错误
2. 查看后端日志
3. 确认数据库表存在

### Q: 技能标签添加无效？
**A**: 确认按下 "Add" 按钮或 Enter 键

### Q: 表单验证不工作？
**A**: 检查 `canProceed()` 函数逻辑

## 📈 后续优化建议

### 短期优化
- [ ] 添加简历上传功能
- [ ] AI 自动提取简历信息
- [ ] 技能推荐（基于行业）
- [ ] 进度保存（草稿功能）

### 长期优化
- [ ] 添加更多行业选项
- [ ] 技能标准化（O*NET 集成）
- [ ] 个性化推荐
- [ ] 多语言支持

## 📚 相关文档

- `GOOGLE_OAUTH_GUIDE.md` - OAuth 设置指南
- `TESTING_CHECKLIST.md` - 测试清单
- `database_setup.sql` - 数据库表结构

## ✅ 完成清单

- [x] 创建 Onboarding 页面
- [x] 4 步骤表单流程
- [x] 左侧进度指示器
- [x] OAuth 回调逻辑更新
- [x] 新用户检测
- [x] 后端 API 端点
- [x] 数据库表更新
- [x] 路由配置
- [x] 响应式设计
- [x] 表单验证

祝使用愉快！🎉

