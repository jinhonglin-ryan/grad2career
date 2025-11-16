from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import logging

import asyncio
import uuid
from datetime import datetime, timezone
from google.genai import types
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService

# import your ADK agent
from app.services.agents.resource_finder_agent.agent import root_agent

router = APIRouter()
logger = logging.getLogger(__name__)


APP_NAME = "resource_finder_agent"
SESSION_SERVICE = InMemorySessionService()
RUNNER = Runner(agent=root_agent, app_name=APP_NAME, session_service=SESSION_SERVICE)
ROOT_AGENT_NAME = getattr(root_agent, "name", "ResourceFinderPipeline")

# Simple in-memory job store
JOBS: Dict[str, Dict[str, Any]] = {}


class AskBody(BaseModel):
    query: str
    user_id: Optional[str] = "web"
    session_id: Optional[str] = "default"
    career_title: Optional[str] = None
    career_id: Optional[str] = None


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


def _event_to_step(event: Any, index: int) -> Dict[str, Any]:
    """Best-effort summarization of an ADK event for clearer progress UI."""
    class_name = event.__class__.__name__
    timestamp = datetime.now(timezone.utc).isoformat()

    # Determine category
    lower_name = class_name.lower()
    if "tool" in lower_name:
        category = "tool"
    elif "agent" in lower_name:
        category = "agent"
    elif "response" in lower_name or "model" in lower_name:
        category = "llm"
    else:
        category = "system"

    step: Dict[str, Any] = {
        "index": index,
        "time": timestamp,
        "category": category,
        "type": class_name,
    }

    # Agent/tool names if present
    if hasattr(event, "agent_name") and getattr(event, "agent_name"):
        step["agent"] = getattr(event, "agent_name")
    if hasattr(event, "tool_name") and getattr(event, "tool_name"):
        step["tool"] = getattr(event, "tool_name")

    # Extract text parts if available
    content = getattr(event, "content", None)
    parts = getattr(content, "parts", None) if content else None
    if parts:
        texts: List[str] = []
        for part in parts:
            text_value = getattr(part, "text", None)
            if text_value:
                texts.append(text_value)
        if texts:
            step["text"] = " \n".join(texts)[:4000]

    # Arguments/results of tool calls, kept short
    if hasattr(event, "args") and getattr(event, "args") is not None:
        try:
            step["args"] = str(getattr(event, "args"))[:1000]
        except Exception:
            step["args"] = "<unserializable args>"
    if hasattr(event, "result") and getattr(event, "result") is not None:
        try:
            step["result"] = str(getattr(event, "result"))[:2000]
        except Exception:
            step["result"] = "<unserializable result>"

    # Mark final response if applicable
    if hasattr(event, "is_final_response") and event.is_final_response():
        step["final_response"] = True

    # Human-readable label combining sub-agent/tool and action
    label_parts: List[str] = []
    if step.get("agent"):
        label_parts.append(str(step["agent"]))
    elif step.get("tool"):
        label_parts.append(str(step["tool"]))
    else:
        label_parts.append(class_name)
    if step.get("final_response"):
        label_parts.append("final response")
    step["label"] = ": ".join(label_parts)

    return step


async def _run_job(job_id: str, query: str, user_id: str, session_id: str, 
                   career_title: Optional[str] = None, career_id: Optional[str] = None) -> None:
    try:
        await _ensure_session(user_id, session_id)
        
        # Enhance query with user context if available
        enhanced_query = query
        if user_id and user_id != "web":
            try:
                from app.core.supabase import get_supabase
                supabase = get_supabase()
                
                # Get user availability information
                user_result = supabase.table('users').select('metadata').eq('id', user_id).execute()
                user_metadata = {}
                if user_result.data and len(user_result.data) > 0:
                    user_metadata = user_result.data[0].get('metadata', {}) or {}
                
                # Get selected training programs
                profile_result = supabase.table('user_profiles')\
                    .select('selected_training_programs')\
                    .eq('user_id', user_id)\
                    .execute()
                
                selected_programs = []
                if profile_result.data and len(profile_result.data) > 0:
                    all_selected = profile_result.data[0].get('selected_training_programs', []) or []
                    # Filter for current career if career_id provided
                    if career_id:
                        selected_programs = [
                            s for s in all_selected 
                            if s.get('career_id') == career_id
                        ]
                    else:
                        selected_programs = all_selected
                
                # Build context string
                context_parts = []
                
                # Add availability constraints
                if user_metadata:
                    state = user_metadata.get('state')
                    travel_constraint = user_metadata.get('travel_constraint')
                    scheduling = user_metadata.get('scheduling')
                    weekly_hours = user_metadata.get('weekly_hours_constraint')
                    
                    # State label mapping
                    state_labels = {
                        'west_virginia': 'West Virginia',
                        'kentucky': 'Kentucky',
                        'pennsylvania': 'Pennsylvania'
                    }
                    
                    if state:
                        state_name = state_labels.get(state, state)
                        context_parts.append(f"User location: {state_name}")
                    if travel_constraint:
                        context_parts.append(f"Travel constraint: {travel_constraint}")
                    if scheduling:
                        context_parts.append(f"Scheduling preference: {scheduling}")
                    if weekly_hours:
                        context_parts.append(f"Weekly hours available: {weekly_hours}")
                
                # Add selected training programs
                if selected_programs and len(selected_programs) > 0:
                    programs_info = []
                    for sel in selected_programs:
                        programs = sel.get('selected_programs', [])
                        if programs:
                            programs_info.append(f"{len(programs)} programs for {sel.get('career_title', 'career')}")
                    if programs_info:
                        context_parts.append(f"User selected training programs: {', '.join(programs_info)}")
                
                # Add career context
                if career_title:
                    context_parts.append(f"Target career: {career_title}")
                
                # Enhance query with context
                if context_parts:
                    context_str = "\n".join(context_parts)
                    enhanced_query = f"{query}\n\nUser Context:\n{context_str}\n\nWhen creating the learning plan, consider the user's availability constraints and include their selected training programs in the schedule."
            
            except Exception as e:
                logger.warning(f"Error fetching user context for agent: {e}")
                # Continue with original query if context fetch fails
        
        content = types.Content(role="user", parts=[types.Part(text=enhanced_query)])

        events = RUNNER.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=content,
        )

        final_text: Optional[str] = None
        step_idx = 0
        async for event in events:
            # Build step and filter out trivial/noise-only events
            step = _event_to_step(event, step_idx)
            has_signal = bool(
                step.get("final_response")
                or step.get("agent")
                or step.get("tool")
                or step.get("text")
            )
            if has_signal:
                JOBS[job_id]["steps"].append(step)
                step_idx += 1

            # Capture any final response text; mark completion after stream ends
            if step.get("final_response"):
                parts = getattr(getattr(event, "content", None), "parts", None) or []
                if parts and hasattr(parts[0], "text"):
                    final_text = parts[0].text

        # Mark completion (use the last final response seen)
        if final_text is None:
            JOBS[job_id]["status"] = "error"
            JOBS[job_id]["error"] = "No final response from agent."
            JOBS[job_id]["steps"].append({
                "index": step_idx,
                "time": datetime.now(timezone.utc).isoformat(),
                "category": "system",
                "type": "RunError",
                "label": f"{ROOT_AGENT_NAME}: error",
                "error": JOBS[job_id]["error"],
            })
        else:
            JOBS[job_id]["status"] = "completed"
            JOBS[job_id]["result"] = {"answer": final_text}
            JOBS[job_id]["steps"].append({
                "index": step_idx,
                "time": datetime.now(timezone.utc).isoformat(),
                "category": "agent",
                "type": "RunCompleted",
                "agent": ROOT_AGENT_NAME,
                "label": f"{ROOT_AGENT_NAME}: completed",
                "preview": (final_text or "")[:500],
            })
    except Exception as e:
        JOBS[job_id]["status"] = "error"
        JOBS[job_id]["error"] = str(e)
        JOBS[job_id]["steps"].append({
            "index": len(JOBS[job_id]["steps"]),
            "time": datetime.now(timezone.utc).isoformat(),
            "category": "system",
            "type": "RunException",
            "label": f"{ROOT_AGENT_NAME}: exception",
            "error": str(e),
        })


@router.post("/ask")
async def ask_agent(body: AskBody) -> Dict[str, Any]:
    """Start an agent run and return a job_id for polling progress/results."""
    job_id = uuid.uuid4().hex
    JOBS[job_id] = {
        "status": "running",
        "steps": [],
        "result": None,
        "error": None,
        "user_id": body.user_id,
        "session_id": body.session_id,
    }

    # Fire-and-forget background task on the current loop
    asyncio.create_task(_run_job(
        job_id, 
        body.query, 
        body.user_id, 
        body.session_id,
        body.career_title,
        body.career_id
    ))

    return {"job_id": job_id, "status": "running"}


@router.get("/status/{job_id}")
async def get_status(job_id: str) -> Dict[str, Any]:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    # Do not return user/session metadata
    response = {
        "status": job.get("status"),
        "steps": job.get("steps", []),
        "result": job.get("result"),
        "error": job.get("error"),
    }
    return response
