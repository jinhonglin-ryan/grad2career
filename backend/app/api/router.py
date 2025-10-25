from fastapi import APIRouter
from app.api.routes import health

router = APIRouter()

router.include_router(health.router, prefix="") 