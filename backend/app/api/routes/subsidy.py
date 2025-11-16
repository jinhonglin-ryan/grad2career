from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
from app.core.supabase import get_supabase
from app.core.config import configure_adk_env
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from app.services.agents.subsidy_agent.agent import root_agent as subsidy_root_agent

configure_adk_env()

router = APIRouter()

APP_NAME = "subsidy_agent"
SESSION_SERVICE = InMemorySessionService()


class SubsidyRequest(BaseModel):
    user_id: str
    grant_name: str
    session_id: Optional[str] = "default"


@router.post("/evaluate")
async def evaluate_subsidy(body: SubsidyRequest) -> Dict[str, Any]:
    """
    Evaluate a user's eligibility checklist for a given grant.
    - Fetches user metadata from 'users' table (jsonb 'metadata')
    - Fetches work_experience from 'user_profiles' by user_id
    - Calls the SubsidyPipeline agent with context and returns structured JSON
    """
    supabase = get_supabase()

    # Fetch user metadata
    user_result = supabase.table("users").select("id, metadata").eq("id", body.user_id).limit(1).execute()
    if not user_result.data:
        raise HTTPException(status_code=404, detail="User not found")
    metadata = user_result.data[0].get("metadata") or {}

    # Fetch user profile (work_experience)
    profile_result = supabase.table("user_profiles").select("user_id, work_experience").eq("user_id", body.user_id).limit(1).execute()
    work_experience = ""
    if profile_result.data:
        work_experience = profile_result.data[0].get("work_experience") or ""

    # Build agent input
    prompt = (
        f"Grant name: {body.grant_name}\n"
        f"User metadata (JSON): {metadata}\n"
        f"User work_experience: {work_experience}\n\n"
        "Use this context to complete the task."
    )

    # Run agent synchronously and capture final JSON
    runner = Runner(agent=subsidy_root_agent, app_name=APP_NAME, session_service=SESSION_SERVICE)
    content = types.Content(role="user", parts=[types.Part(text=prompt)])

    final_text: Optional[str] = None
    try:
        # Ensure session exists for this user/session_id
        try:
            await SESSION_SERVICE.create_session(app_name=APP_NAME, user_id=body.user_id, session_id=body.session_id)
        except Exception:
            pass

        async for event in runner.run_async(user_id=body.user_id, session_id=body.session_id, new_message=content):
            if hasattr(event, "is_final_response") and event.is_final_response():
                parts = getattr(getattr(event, "content", None), "parts", None) or []
                if parts and hasattr(parts[0], "text"):
                    final_text = parts[0].text
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent run failed: {str(e)}")

    if not final_text:
        raise HTTPException(status_code=500, detail="No final response from agent")

    # Best-effort parse to dict
    import json
    parsed: Dict[str, Any]
    try:
        parsed = json.loads(final_text)
    except Exception:
        # Try to extract JSON code block
        import re
        m = re.search(r"```json[\\s\\S]*?({[\\s\\S]*?})[\\s\\S]*?```", final_text)
        if m:
            try:
                parsed = json.loads(m.group(1))
            except Exception:
                parsed = {"status": "error", "error_message": "Failed to parse agent response", "raw": final_text}
        else:
            parsed = {"status": "error", "error_message": "Failed to parse agent response", "raw": final_text}

    # Ensure sources are present even if empty
    if "sources" not in parsed:
        parsed["sources"] = []
    if "grant_name" not in parsed:
        parsed["grant_name"] = body.grant_name

    return {"status": "success", "data": parsed}


