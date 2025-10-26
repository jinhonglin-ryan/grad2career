# Google OAuth 设置指南

本指南介绍如何在后端实现 Google OAuth 登录功能。

## 1. 获取 Google OAuth 凭据

### 步骤 1: 创建 Google Cloud 项目

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 在项目中启用 "Google+ API"

### 步骤 2: 创建 OAuth 2.0 凭据

1. 导航到 "APIs & Services" > "Credentials"
2. 点击 "Create Credentials" > "OAuth client ID"
3. 选择应用类型: "Web application"
4. 配置:
   - **Name**: SkillBridge
   - **Authorized JavaScript origins**: 
     - `http://localhost:5173` (开发环境)
     - `https://your-domain.com` (生产环境)
   - **Authorized redirect URIs**:
     - `http://localhost:5173/auth/callback` (开发环境)
     - `https://your-domain.com/auth/callback` (生产环境)
     - `http://127.0.0.1:8000/auth/google/callback` (后端回调)

5. 保存后获取 `Client ID` 和 `Client Secret`

## 2. 后端配置

### 更新 .env 文件

在 `backend/.env` 中添加：

```env
# Supabase 配置
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key
SUPABASE_ANON_KEY=your_anon_key

# Google OAuth 配置
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://127.0.0.1:8000/auth/google/callback

# 前端 URL (用于重定向)
FRONTEND_URL=http://localhost:5173
```

### 安装依赖

```bash
pip install authlib
pip install httpx
```

在 `requirements.txt` 中添加：

```txt
authlib==1.2.1
httpx==0.27.0
```

## 3. 后端实现

### 创建 OAuth 路由

创建 `backend/app/api/routes/auth.py`:

```python
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth
from app.core.config import settings
import jwt
from datetime import datetime, timedelta

router = APIRouter()

# 配置 OAuth
oauth = OAuth()
oauth.register(
    name='google',
    client_id=settings.google_client_id,
    client_secret=settings.google_client_secret,
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile'
    }
)

@router.get("/google/login")
async def google_login(request: Request):
    """启动 Google OAuth 流程"""
    redirect_uri = settings.google_redirect_uri
    return await oauth.google.authorize_redirect(request, redirect_uri)

@router.get("/google/callback")
async def google_callback(request: Request):
    """处理 Google OAuth 回调"""
    try:
        # 获取访问令牌
        token = await oauth.google.authorize_access_token(request)
        
        # 获取用户信息
        user_info = token.get('userinfo')
        if not user_info:
            raise HTTPException(status_code=400, detail="Failed to get user info")
        
        email = user_info.get('email')
        name = user_info.get('name')
        picture = user_info.get('picture')
        
        # 在数据库中查找或创建用户
        # TODO: 实现数据库逻辑
        # user = get_or_create_user(email=email, name=name, picture=picture)
        
        # 生成 JWT token
        jwt_token = create_jwt_token(
            user_id="user_id",  # 替换为真实用户 ID
            email=email
        )
        
        # 重定向到前端并带上 token
        frontend_callback = f"{settings.frontend_url}/auth/callback?token={jwt_token}"
        return RedirectResponse(url=frontend_callback)
        
    except Exception as e:
        error_url = f"{settings.frontend_url}/auth/callback?error={str(e)}"
        return RedirectResponse(url=error_url)

def create_jwt_token(user_id: str, email: str) -> str:
    """创建 JWT token"""
    payload = {
        'user_id': user_id,
        'email': email,
        'exp': datetime.utcnow() + timedelta(days=7)
    }
    secret_key = settings.jwt_secret_key  # 需要在 settings 中添加
    return jwt.encode(payload, secret_key, algorithm='HS256')

@router.post("/login")
async def login(email: str, password: str):
    """常规邮箱密码登录"""
    # TODO: 实现登录逻辑
    pass

@router.post("/signup")
async def signup(email: str, password: str, name: str):
    """用户注册"""
    # TODO: 实现注册逻辑
    pass
```

### 更新 settings.py

在 `backend/app/core/config.py` 中添加：

```python
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    supabase_url: str
    supabase_service_role_key: str
    supabase_anon_key: Optional[str] = None
    
    # Google OAuth
    google_client_id: str
    google_client_secret: str
    google_redirect_uri: str
    
    # JWT
    jwt_secret_key: str = "your-secret-key-change-in-production"
    
    # Frontend
    frontend_url: str = "http://localhost:5173"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
```

### 注册路由

在 `backend/app/api/router.py` 中：

```python
from fastapi import APIRouter
from app.api.routes import health, auth

router = APIRouter()

router.include_router(health.router, prefix="")
router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
```

## 4. 测试流程

### 开发环境测试

1. **启动后端**:
   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```

2. **启动前端**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **测试登录**:
   - 访问 `http://localhost:5173/login`
   - 点击 "Sign in with Google"
   - 完成 Google 登录
   - 应该重定向回 `/auth/callback` 然后到 `/dashboard`

### 验证 OAuth 流程

1. 点击 Google 登录按钮
2. 浏览器重定向到 Google 登录页面
3. 登录后，Google 重定向到后端 `/auth/google/callback`
4. 后端处理并重定向到前端 `/auth/callback?token=xxx`
5. 前端保存 token 并重定向到 dashboard

## 5. 安全注意事项

### 生产环境配置

1. **使用 HTTPS**: 所有 OAuth 流程必须使用 HTTPS
2. **更新重定向 URI**: 在 Google Console 中添加生产环境 URL
3. **环境变量安全**: 
   - 不要将 `.env` 文件提交到 Git
   - 使用环境变量管理服务（如 Railway Secrets）
4. **JWT 密钥**: 使用强随机密钥
5. **CORS 配置**: 只允许可信的前端域名

### FastAPI CORS 配置

在 `backend/app/main.py` 中：

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="SkillBridge API")

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://your-domain.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## 6. 数据库集成 (Supabase)

### 用户表结构

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    picture TEXT,
    auth_provider VARCHAR(50) DEFAULT 'email',  -- 'email' 或 'google'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    skills JSONB,
    certifications JSONB,
    career_goals TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Python 数据库操作

```python
from supabase import create_client
from app.core.config import settings

supabase = create_client(
    settings.supabase_url,
    settings.supabase_service_role_key
)

def get_or_create_user(email: str, name: str, picture: str):
    """获取或创建 Google OAuth 用户"""
    # 查找用户
    result = supabase.table('users').select('*').eq('email', email).execute()
    
    if result.data:
        return result.data[0]
    
    # 创建新用户
    new_user = {
        'email': email,
        'name': name,
        'picture': picture,
        'auth_provider': 'google'
    }
    result = supabase.table('users').insert(new_user).execute()
    return result.data[0]
```

## 7. 故障排除

### 常见问题

1. **redirect_uri_mismatch**
   - 确保 Google Console 中的重定向 URI 与代码中的完全匹配
   - 包括协议 (http/https)、域名和端口

2. **CORS 错误**
   - 检查后端 CORS 配置
   - 确保前端 URL 在允许列表中

3. **Token 未保存**
   - 检查浏览器控制台
   - 验证 localStorage 权限

4. **回调失败**
   - 检查后端日志
   - 验证环境变量配置

## 8. 下一步

- [ ] 实现用户数据库模型
- [ ] 添加会话管理
- [ ] 实现刷新 token 机制
- [ ] 添加用户权限控制
- [ ] 支持其他 OAuth 提供商（LinkedIn, GitHub 等）

## 参考资源

- [FastAPI OAuth 文档](https://fastapi.tiangolo.com/advanced/security/)
- [Authlib 文档](https://docs.authlib.org/)
- [Google OAuth 文档](https://developers.google.com/identity/protocols/oauth2)
- [Supabase Auth 文档](https://supabase.com/docs/guides/auth)

