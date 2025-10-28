from fastapi import APIRouter
from app.api.routes import health, auth, agent

router = APIRouter()

router.include_router(health.router, prefix="")
router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
router.include_router(agent.router, prefix="/agent", tags=["Agent"])