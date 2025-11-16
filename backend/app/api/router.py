from fastapi import APIRouter
from app.api.routes import health, auth, agent, skills, youtube, learning, careers, training

router = APIRouter()

router.include_router(health.router, prefix="")
router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
router.include_router(agent.router, prefix="/agent", tags=["Agent"])
router.include_router(skills.router, prefix="/skills", tags=["Skills Assessment"])
router.include_router(careers.router, prefix="/careers", tags=["Career Matching"])
router.include_router(youtube.router, prefix="/youtube", tags=["YouTube"])
router.include_router(learning.router, prefix="/learning", tags=["Learning Path"])
router.include_router(training.router, prefix="/training", tags=["Training Programs"])