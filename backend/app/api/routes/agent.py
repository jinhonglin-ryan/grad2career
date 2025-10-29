from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any

import asyncio
from google.genai import types
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService

# import your ADK agent
from app.services.agents.resource_finder_agent.agent import root_agent

router = APIRouter()


APP_NAME = "resource_finder_agent"
SESSION_SERVICE = InMemorySessionService()
RUNNER = Runner(agent=root_agent, app_name=APP_NAME, session_service=SESSION_SERVICE)

class AskBody(BaseModel):
    query: str
    user_id: Optional[str] = "web"
    session_id: Optional[str] = "default"

async def _ensure_session(user_id: str, session_id: str) -> None:
    """
    Create the session if it doesn't exist yet.
    If it already exists, ignore the error.
    """
    try:
        await SESSION_SERVICE.create_session(
            app_name=APP_NAME, user_id=user_id, session_id=session_id
        )
    except Exception:
        pass

def _extract_final_text_from_events(events_iter):
    """
    Given an async iterator of ADK Events, return the final assistant text.
    """
    async def _collect():
        final_text = None
        async for event in events_iter:
            if hasattr(event, "is_final_response") and event.is_final_response():
                parts = getattr(getattr(event, "content", None), "parts", None) or []
                if parts and hasattr(parts[0], "text"):
                    final_text = parts[0].text
        return final_text
    return _collect()

@router.post("/ask")
async def ask_agent(body: AskBody) -> Dict[str, Any]:
    # Ensure session exists (or reuse if it does)
    await _ensure_session(body.user_id, body.session_id)

    # Build ADK Content for the new user message
    content = types.Content(role="user", parts=[types.Part(text=body.query)])

    # Run the agent (non-streaming here; we iterate the async generator and pick the final event)
    try:
        events = RUNNER.run_async(
            user_id=body.user_id,
            session_id=body.session_id,
            new_message=content,
        )
        final_text = await _extract_final_text_from_events(events)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not final_text:
        raise HTTPException(status_code=500, detail="No final response from agent.")
    return {"answer": final_text}
