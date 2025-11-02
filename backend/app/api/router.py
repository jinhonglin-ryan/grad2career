from fastapi import APIRouter
from app.api.routes import health, auth, agent, skills, youtube

router = APIRouter()

router.include_router(health.router, prefix="")
router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
router.include_router(agent.router, prefix="/agent", tags=["Agent"])
router.include_router(skills.router, prefix="/skills", tags=["Skills Assessment"])
router.include_router(youtube.router, prefix="/youtube", tags=["YouTube"])