from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.router import router as api_router
from app.core.config import settings, configure_adk_env
import os

app = FastAPI(title="SkillBridge API")


configure_adk_env()

# 配置 CORS - 动态获取允许的来源
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# 添加环境变量中的前端 URL
if settings.frontend_url:
    allowed_origins.append(settings.frontend_url)

# 从环境变量读取额外的允许来源（逗号分隔）
extra_origins = os.getenv("EXTRA_CORS_ORIGINS", "")
if extra_origins:
    allowed_origins.extend([origin.strip() for origin in extra_origins.split(",")])

print(f"🌐 CORS allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

@app.get("/")
async def root():
    """健康检查端点"""
    return {
        "status": "ok",
        "service": "SkillBridge API",
        "message": "API is running. Visit /docs for API documentation."
    }