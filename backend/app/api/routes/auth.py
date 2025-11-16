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
    if not settings.google_client_id:
        raise HTTPException(
            status_code=503,
            detail="Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables."
        )
    
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
    if not settings.google_client_id or not settings.google_client_secret:
        error_url = f"{settings.frontend_url}/auth/callback?error=Google OAuth is not configured"
        return RedirectResponse(url=error_url)
    
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
        
        is_new_user = False
        
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
            
            # Check if user has completed onboarding
            # Check both column and metadata fallback
            onboarding_completed = user.get('onboarding_completed', False)
            if not onboarding_completed:
                # Fallback: check metadata if column doesn't exist or is False
                metadata = user.get('metadata', {})
                if isinstance(metadata, dict):
                    onboarding_completed = metadata.get('onboarding_completed', False)
            
            if not onboarding_completed:
                is_new_user = True
        else:
            # 创建新用户
            # Don't include onboarding_completed if column doesn't exist - use metadata instead
            new_user = {
                'email': email,
                'name': name,
                'picture': picture,
                'auth_provider': 'google',
                'metadata': {'onboarding_completed': False},  # Store in metadata as fallback
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat()
            }
            # Try to insert with onboarding_completed column, fallback if it doesn't exist
            try:
                new_user['onboarding_completed'] = False
                user_result = supabase.table('users').insert(new_user).execute()
            except Exception as e:
                # If column doesn't exist, remove it and try again
                error_str = str(e).lower()
                if 'onboarding_completed' in error_str or 'pgrst204' in error_str:
                    new_user.pop('onboarding_completed', None)
                    user_result = supabase.table('users').insert(new_user).execute()
                else:
                    raise
            user = user_result.data[0]
            is_new_user = True
        
        # 生成 JWT token
        jwt_token = create_jwt_token(user['id'], email)
        
        # 重定向到前端并带上 token 和 new_user 标记
        frontend_callback = f"{settings.frontend_url}/auth/callback?token={jwt_token}&new_user={str(is_new_user).lower()}"
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
        
        # Check if user has completed onboarding
        # Check both column and metadata fallback
        onboarding_completed = user.get('onboarding_completed', False)
        if not onboarding_completed:
            # Fallback: check metadata if column doesn't exist or is False
            metadata = user.get('metadata', {})
            if isinstance(metadata, dict):
                onboarding_completed = metadata.get('onboarding_completed', False)
        
        # 生成 JWT token
        jwt_token = create_jwt_token(user['id'], user['email'])
        
        return TokenResponse(
            token=jwt_token,
            user={
                'id': user['id'],
                'email': user['email'],
                'name': user.get('name'),
                'picture': user.get('picture'),
                'onboarding_completed': onboarding_completed
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
        # Don't include onboarding_completed if column doesn't exist - use metadata instead
        new_user = {
            'email': request.email,
            'name': request.name,
            'auth_provider': 'email',
            'metadata': {'onboarding_completed': False},  # Store in metadata as fallback
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }
        # Try to insert with onboarding_completed column, fallback if it doesn't exist
        try:
            new_user['onboarding_completed'] = False
            user_result = supabase.table('users').insert(new_user).execute()
        except Exception as e:
            # If column doesn't exist, remove it and try again
            error_str = str(e).lower()
            if 'onboarding_completed' in error_str or 'pgrst204' in error_str:
                new_user.pop('onboarding_completed', None)
                user_result = supabase.table('users').insert(new_user).execute()
            else:
                raise
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
async def get_current_user(request: Request):
    """获取当前用户信息"""
    # 从请求头获取 token
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    token = auth_header.replace('Bearer ', '')
    payload = verify_jwt_token(token)
    
    supabase = get_supabase()
    user_result = supabase.table('users').select('*').eq('id', payload['user_id']).execute()
    
    if not user_result.data or len(user_result.data) == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = user_result.data[0]
    
    # Check if user has completed onboarding
    # Check both column and metadata fallback
    onboarding_completed = user.get('onboarding_completed', False)
    if not onboarding_completed:
        # Fallback: check metadata if column doesn't exist or is False
        metadata = user.get('metadata', {})
        if isinstance(metadata, dict):
            onboarding_completed = metadata.get('onboarding_completed', False)
    
    return {
        'id': user['id'],
        'email': user['email'],
        'name': user.get('name'),
        'picture': user.get('picture'),
        'onboarding_completed': onboarding_completed
    }

@router.post("/logout")
async def logout():
    """登出"""
    return {"message": "Logged out successfully"}

@router.get("/user/profile")
async def get_user_profile(request: Request):
    """获取完整用户档案（用户信息 + profile + metadata）"""
    # 从请求头获取 token
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    token = auth_header.replace('Bearer ', '')
    payload = verify_jwt_token(token)
    user_id = payload['user_id']
    
    supabase = get_supabase()
    
    try:
        # 获取用户基本信息
        user_result = supabase.table('users').select('*').eq('id', user_id).execute()
        
        if not user_result.data or len(user_result.data) == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        user = user_result.data[0]
        
        # 获取 user_profiles 数据
        profile_result = supabase.table('user_profiles').select('*').eq('user_id', user_id).execute()
        profile_data = profile_result.data[0] if profile_result.data and len(profile_result.data) > 0 else None
        
        # 获取 metadata
        metadata = user.get('metadata', {})
        if not isinstance(metadata, dict):
            metadata = {}
        
        # Check onboarding status
        onboarding_completed = user.get('onboarding_completed', False)
        if not onboarding_completed:
            onboarding_completed = metadata.get('onboarding_completed', False)
        
        # 组合返回数据
        return {
            'user': {
                'id': user['id'],
                'email': user['email'],
                'name': user.get('name'),
                'picture': user.get('picture'),
                'auth_provider': user.get('auth_provider', 'email'),
                'onboarding_completed': onboarding_completed,
                'created_at': user.get('created_at'),
                'updated_at': user.get('updated_at')
            },
            'profile': profile_data,
            'metadata': metadata
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching user profile: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch user profile: {str(e)}")

@router.put("/user/profile")
async def update_user_profile(profile_update: dict, request: Request):
    """更新用户档案信息"""
    # 从请求头获取 token
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    token = auth_header.replace('Bearer ', '')
    payload = verify_jwt_token(token)
    user_id = payload['user_id']
    
    supabase = get_supabase()
    
    try:
        # 准备更新的数据
        user_updates = {}
        profile_updates = {}
        metadata_updates = {}
        
        # 可以更新的用户字段
        if 'name' in profile_update:
            user_updates['name'] = profile_update['name']
        if 'picture' in profile_update:
            user_updates['picture'] = profile_update['picture']
        
        # 可以更新的 profile 字段 (only basic fields that exist in all schemas)
        if 'career_goals' in profile_update:
            profile_updates['career_goals'] = profile_update['career_goals']
        if 'work_experience' in profile_update:
            profile_updates['work_experience'] = profile_update['work_experience']
        # Mining-specific fields
        if 'previous_job_title' in profile_update:
            profile_updates['previous_job_title'] = profile_update['previous_job_title']
        if 'mining_role' in profile_update:
            profile_updates['mining_role'] = profile_update['mining_role']
        if 'mining_type' in profile_update:
            profile_updates['mining_type'] = profile_update['mining_type']
        if 'years_mining_experience' in profile_update:
            profile_updates['years_mining_experience'] = profile_update['years_mining_experience']
        # Note: skills, tools, certifications are handled by the assessment flow
        # and stored in JSONB columns which may not exist in all database versions
        
        # 可以更新的 metadata 字段（onboarding 相关）
        metadata_fields = [
            'state', 'travel_constraint', 'budget_constraint',
            'scheduling', 'weekly_hours_constraint', 'transition_goal',
            'transition_goal_text', 'target_sector', 'age', 'veteran_status'
        ]
        
        for field in metadata_fields:
            if field in profile_update:
                metadata_updates[field] = profile_update[field]
        
        # 更新 users 表
        if user_updates:
            user_updates['updated_at'] = datetime.utcnow().isoformat()
            supabase.table('users').update(user_updates).eq('id', user_id).execute()
        
        # 更新 user_profiles 表
        if profile_updates:
            profile_updates['updated_at'] = datetime.utcnow().isoformat()
            # 检查 profile 是否存在
            existing_profile = supabase.table('user_profiles').select('*').eq('user_id', user_id).execute()
            if existing_profile.data and len(existing_profile.data) > 0:
                supabase.table('user_profiles').update(profile_updates).eq('user_id', user_id).execute()
            else:
                # 如果不存在，创建新的 profile
                profile_updates['user_id'] = user_id
                profile_updates['created_at'] = datetime.utcnow().isoformat()
                supabase.table('user_profiles').insert(profile_updates).execute()
        
        # 更新 metadata
        if metadata_updates:
            # 获取现有 metadata
            user_result = supabase.table('users').select('metadata').eq('id', user_id).execute()
            existing_metadata = {}
            if user_result.data and len(user_result.data) > 0:
                existing_metadata = user_result.data[0].get('metadata', {})
                if not isinstance(existing_metadata, dict):
                    existing_metadata = {}
            
            # 合并 metadata
            updated_metadata = {**existing_metadata, **metadata_updates}
            
            # 更新 users 表
            supabase.table('users').update({
                'metadata': updated_metadata,
                'updated_at': datetime.utcnow().isoformat()
            }).eq('id', user_id).execute()
        
        return {
            "message": "Profile updated successfully",
            "updated_fields": {
                "user": list(user_updates.keys()),
                "profile": list(profile_updates.keys()),
                "metadata": list(metadata_updates.keys())
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating user profile: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update user profile: {str(e)}")

@router.post("/user/profile")
async def save_user_profile(profile_data: dict, request: Request):
    """保存用户 onboarding 数据（Logistical Constraints + Motivation & Context）"""
    # 从请求头获取 token
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    token = auth_header.replace('Bearer ', '')
    
    # 验证 token
    payload = verify_jwt_token(token)
    user_id = payload['user_id']
    
    supabase = get_supabase()
    
    try:
        # 检查是否已有 profile
        existing_profile = supabase.table('user_profiles').select('*').eq('user_id', user_id).execute()
        
        # Map transition goal to a readable format
        transition_goal_map = {
            'quick': 'Get back to work quickly (6 months)',
            'earnings': 'Higher long-term earnings',
            'stable': 'Career change to a stable industry'
        }
        transition_goal = profile_data.get('transitionGoal', '')
        career_goals_text = transition_goal_map.get(transition_goal, transition_goal)
        
        # Build profile payload with onboarding data
        # Only include career_goals and work_experience (basic fields that should exist)
        # Skills, tools, certifications will be added by the assessment flow
        profile_payload = {
            'user_id': user_id,
            'career_goals': career_goals_text,  # Store transition goal
            'updated_at': datetime.utcnow().isoformat()
        }
        
        # Only set work_experience if profile doesn't exist yet
        if not existing_profile.data or len(existing_profile.data) == 0:
            profile_payload['work_experience'] = ''
        
        # Store all onboarding data in users.metadata
        metadata = {
            # Screen 1: Logistical Constraints
            'state': profile_data.get('state'),
            'travel_constraint': profile_data.get('travelConstraint'),
            'budget_constraint': profile_data.get('budgetConstraint'),
            'scheduling': profile_data.get('scheduling'),
            'weekly_hours_constraint': profile_data.get('weeklyHoursConstraint'),
            
            # Screen 2: Motivation & Context
            'transition_goal': transition_goal,
            'transition_goal_text': career_goals_text,
            'target_sector': profile_data.get('targetSector'),
            'age': profile_data.get('age'),  # Optional
            'veteran_status': profile_data.get('veteranStatus'),  # Optional
            
            # Timestamps
            'onboarding_completed_at': datetime.utcnow().isoformat()
        }
        
        # Update or create user_profiles - try to save, but don't fail if table has schema issues
        profile_result = None
        profile_saved = False
        try:
            if existing_profile.data and len(existing_profile.data) > 0:
                # Update existing profile - update career_goals and preserve existing data
                profile_result = supabase.table('user_profiles').update(profile_payload).eq('user_id', user_id).execute()
                profile_saved = profile_result.data is not None
            else:
                # Create new profile
                profile_payload['created_at'] = datetime.utcnow().isoformat()
                profile_result = supabase.table('user_profiles').insert(profile_payload).execute()
                profile_saved = profile_result.data is not None
        except Exception as profile_error:
            # Log error but continue - onboarding data will still be saved in metadata
            print(f"Warning: Could not save to user_profiles table: {str(profile_error)}")
            # Don't raise - we'll store everything in metadata instead
            profile_saved = False
        
        # Store onboarding completion status in metadata (always works)
        metadata['onboarding_completed'] = True
        
        # If user already has metadata, merge it (preserve existing data)
        existing_user = supabase.table('users').select('metadata').eq('id', user_id).execute()
        if existing_user.data and len(existing_user.data) > 0:
            existing_metadata = existing_user.data[0].get('metadata', {})
            if isinstance(existing_metadata, dict):
                # Merge with existing metadata (new onboarding data takes precedence)
                metadata = {**existing_metadata, **metadata}
        
        # Save metadata to user table
        user_update = {
            'metadata': metadata,
            'updated_at': datetime.utcnow().isoformat()
        }
        
        # Try to update onboarding_completed columns if they exist
        # If they don't exist, the status is still saved in metadata
        try:
            supabase.table('users').update({
                **user_update,
                'onboarding_completed': True,
                'onboarding_completed_at': datetime.utcnow().isoformat()
            }).eq('id', user_id).execute()
        except Exception as e:
            # If onboarding_completed column doesn't exist, update without it
            # The status is already stored in metadata above
            error_str = str(e).lower()
            if 'onboarding_completed' in error_str or 'pgrst204' in error_str or 'schema cache' in error_str:
                # Fallback: just update metadata (columns will need to be added via migration)
                supabase.table('users').update(user_update).eq('id', user_id).execute()
            else:
                raise
        
        return {
            "message": "Onboarding completed successfully",
            "profile": profile_result.data if profile_result else None,
            "user_profile_updated": profile_saved,
            "onboarding_completed": True,
            "note": "All onboarding data saved in user metadata" if not profile_saved else None
        }
        
    except Exception as e:
        print(f"Error saving profile: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save profile: {str(e)}")

