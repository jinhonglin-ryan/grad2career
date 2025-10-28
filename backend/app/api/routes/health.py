from fastapi import APIRouter
from app.core.supabase import get_supabase

router = APIRouter()

@router.get("/health/supabase", tags=["Health"])
def supabase_health():
    """
    Check Supabase connectivity.
    Returns {'ok': True} if the connection works.
    """
    client = get_supabase()
    try:
        client.table("user_profiles").select("user_id").limit(1).execute()
        return {"ok": True, "supabase": "connected"}
    except Exception as e:
        return {"ok": False, "error": str(e)}