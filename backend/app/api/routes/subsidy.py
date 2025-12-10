import json
import re
import logging
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

logger = logging.getLogger("subsidy_route")
if not logger.handlers:
    _handler = logging.StreamHandler()
    _formatter = logging.Formatter(
        fmt="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    _handler.setFormatter(_formatter)
    logger.addHandler(_handler)
logger.setLevel(logging.INFO)

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
    Evaluate a user's eligibility checklist and documentation requirements for a given grant.
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
        "Use this context to complete the eligibility and documentation research tasks."
    )
    
    logger.info(f"Starting subsidy evaluation for grant: {body.grant_name}")

    # Generate unique session ID to avoid state conflicts
    import uuid
    unique_session_id = f"{body.session_id}_{uuid.uuid4().hex[:8]}"

    # Run agent and capture responses
    runner = Runner(agent=subsidy_root_agent, app_name=APP_NAME, session_service=SESSION_SERVICE)
    content = types.Content(role="user", parts=[types.Part(text=prompt)])

    final_text: Optional[str] = None
    all_responses: list = []
    
    try:
        # Create a fresh session
        try:
            await SESSION_SERVICE.create_session(app_name=APP_NAME, user_id=body.user_id, session_id=unique_session_id)
        except Exception as e:
            logger.warning(f"Session creation warning: {e}")

        async for event in runner.run_async(user_id=body.user_id, session_id=unique_session_id, new_message=content):
            # Log all events for debugging
            if hasattr(event, "content") and event.content:
                parts = getattr(event.content, "parts", None) or []
                for part in parts:
                    if hasattr(part, "text") and part.text:
                        all_responses.append(part.text)
                        logger.info(f"Agent response part: {part.text[:200]}...")
            
            if hasattr(event, "is_final_response") and event.is_final_response():
                parts = getattr(getattr(event, "content", None), "parts", None) or []
                if parts and hasattr(parts[0], "text"):
                    final_text = parts[0].text
                    logger.info(f"Final response received: {final_text[:500]}...")
                    
    except Exception as e:
        logger.error(f"Agent run failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Agent run failed: {str(e)}")

    if not final_text:
        # Try to use the last response if no final response was marked
        if all_responses:
            final_text = all_responses[-1]
            logger.info(f"Using last response as final: {final_text[:500]}...")
        else:
            raise HTTPException(status_code=500, detail="No response from agent")

    # Parse the response
    parsed: Dict[str, Any]
    try:
        parsed = json.loads(final_text)
        logger.info(f"Parsed JSON successfully: {list(parsed.keys())}")
    except Exception:
        # Try to extract JSON code block
        m = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", final_text)
        if m:
            try:
                parsed = json.loads(m.group(1))
                logger.info(f"Parsed JSON from code block: {list(parsed.keys())}")
            except Exception:
                logger.error(f"Failed to parse JSON from code block")
                parsed = {"status": "error", "error_message": "Failed to parse agent response", "raw": final_text}
        else:
            # Try to find any JSON object in the response
            m2 = re.search(r"(\{[\s\S]*\})", final_text)
            if m2:
                try:
                    parsed = json.loads(m2.group(1))
                    logger.info(f"Parsed JSON from raw text: {list(parsed.keys())}")
                except Exception:
                    logger.error(f"Failed to parse any JSON from response")
                    parsed = {"status": "error", "error_message": "Failed to parse agent response", "raw": final_text}
            else:
                logger.error(f"No JSON found in response")
                parsed = {"status": "error", "error_message": "Failed to parse agent response", "raw": final_text}

    # Ensure required fields are present even if empty
    if "checklist" not in parsed:
        parsed["checklist"] = []
        logger.warning("No checklist found in parsed response")
    if "documents" not in parsed:
        parsed["documents"] = []
        logger.warning("No documents found in parsed response")
    if "grant_name" not in parsed:
        parsed["grant_name"] = body.grant_name
    if "status" not in parsed:
        parsed["status"] = "success"

    logger.info(f"Returning response with {len(parsed.get('checklist', []))} checklist items and {len(parsed.get('documents', []))} documents")
    
    return {"status": "success", "data": parsed}
