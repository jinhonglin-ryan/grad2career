from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import RedirectResponse, JSONResponse
from pydantic import BaseModel, EmailStr
from typing import Optional
import httpx
import jwt
from datetime import datetime, timedelta
from app.core.config import settings
from app.core.supabase import get_supabase

router = APIRouter()

# Pydantic models
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None

class TokenResponse(BaseModel):
    token: str
    user: dict

# Google OAuth URLs
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

def create_jwt_token(user_id: str, email: str) -> str:
    """创建 JWT token"""
    payload = {
        'user_id': user_id,
        'email': email,
        'exp': datetime.utcnow() + timedelta(minutes=settings.jwt_expiration_minutes),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)

def verify_jwt_token(token: str) -> dict:
    """验证 JWT token"""
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.get("/google/login")
async def google_login():
    """启动 Google OAuth 流程"""
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent"
    }
    
    auth_url = f"{GOOGLE_AUTH_URL}?{'&'.join([f'{k}={v}' for k, v in params.items()])}"
    return {"url": auth_url}

@router.get("/google/callback")
async def google_callback(code: str = None, error: str = None):
    """处理 Google OAuth 回调"""
    if error:
        error_url = f"{settings.frontend_url}/auth/callback?error={error}"
        return RedirectResponse(url=error_url)
    
    if not code:
        error_url = f"{settings.frontend_url}/auth/callback?error=No authorization code received"
        return RedirectResponse(url=error_url)
    
    try:
        # 交换 authorization code 获取 access token
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "redirect_uri": settings.google_redirect_uri,
                    "grant_type": "authorization_code"
                }
            )
            
            if token_response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to get access token")
            
            token_data = token_response.json()
            access_token = token_data.get("access_token")
            
            # 使用 access token 获取用户信息
            user_response = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            
            if user_response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to get user info")
            
            user_info = user_response.json()
            
        # 获取用户信息
        email = user_info.get("email")
        name = user_info.get("name")
        picture = user_info.get("picture")
        
        if not email:
            error_url = f"{settings.frontend_url}/auth/callback?error=No email received from Google"
            return RedirectResponse(url=error_url)
        
        # 在 Supabase 中查找或创建用户
        supabase = get_supabase()
        
        # 查找现有用户
        user_result = supabase.table('users').select('*').eq('email', email).execute()
        
        if user_result.data and len(user_result.data) > 0:
            # 用户存在，更新信息
            user = user_result.data[0]
            update_data = {
                'name': name,
                'picture': picture,
                'auth_provider': 'google',
                'updated_at': datetime.utcnow().isoformat()
            }
            supabase.table('users').update(update_data).eq('id', user['id']).execute()
        else:
            # 创建新用户
            new_user = {
                'email': email,
                'name': name,
                'picture': picture,
                'auth_provider': 'google',
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            }
            user_result = supabase.table('users').insert(new_user).execute()
            user = user_result.data[0]
        
        # 生成 JWT token
        jwt_token = create_jwt_token(user['id'], email)
        
        # 重定向到前端并带上 token
        frontend_callback = f"{settings.frontend_url}/auth/callback?token={jwt_token}"
        return RedirectResponse(url=frontend_callback)
        
    except Exception as e:
        print(f"OAuth error: {str(e)}")
        error_url = f"{settings.frontend_url}/auth/callback?error={str(e)}"
        return RedirectResponse(url=error_url)

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """邮箱密码登录"""
    supabase = get_supabase()
    
    try:
        # 查找用户
        user_result = supabase.table('users').select('*').eq('email', request.email).execute()
        
        if not user_result.data or len(user_result.data) == 0:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        user = user_result.data[0]
        
        # TODO: 验证密码 (需要实现密码哈希验证)
        # For now, we'll just check if user exists
        
        # 生成 JWT token
        jwt_token = create_jwt_token(user['id'], user['email'])
        
        return TokenResponse(
            token=jwt_token,
            user={
                'id': user['id'],
                'email': user['email'],
                'name': user.get('name'),
                'picture': user.get('picture')
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Login error: {str(e)}")
        raise HTTPException(status_code=500, detail="Login failed")

@router.post("/signup", response_model=TokenResponse)
async def signup(request: SignupRequest):
    """用户注册"""
    supabase = get_supabase()
    
    try:
        # 检查用户是否已存在
        existing_user = supabase.table('users').select('*').eq('email', request.email).execute()
        
        if existing_user.data and len(existing_user.data) > 0:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # 创建新用户
        # TODO: 实现密码哈希
        new_user = {
            'email': request.email,
            'name': request.name,
            'auth_provider': 'email',
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        user_result = supabase.table('users').insert(new_user).execute()
        user = user_result.data[0]
        
        # 生成 JWT token
        jwt_token = create_jwt_token(user['id'], user['email'])
        
        return TokenResponse(
            token=jwt_token,
            user={
                'id': user['id'],
                'email': user['email'],
                'name': user.get('name')
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Signup error: {str(e)}")
        raise HTTPException(status_code=500, detail="Signup failed")

@router.get("/me")
async def get_current_user(token: str):
    """获取当前用户信息"""
    payload = verify_jwt_token(token)
    
    supabase = get_supabase()
    user_result = supabase.table('users').select('*').eq('id', payload['user_id']).execute()
    
    if not user_result.data or len(user_result.data) == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = user_result.data[0]
    return {
        'id': user['id'],
        'email': user['email'],
        'name': user.get('name'),
        'picture': user.get('picture')
    }

@router.post("/logout")
async def logout():
    """登出"""
    return {"message": "Logged out successfully"}

