from fastapi import APIRouter
from app.api.routes import health, auth

router = APIRouter()

router.include_router(health.router, prefix="")
router.include_router(auth.router, prefix="/auth", tags=["Authentication"]) 