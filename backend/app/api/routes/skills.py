"""
API Routes for Conversational Skill Assessment
"""
import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.services.conversational_assessment import (
    ConversationalAssessmentService,
    TURN_PROMPTS
)
from app.services.session_manager import session_manager
from app.core.supabase import get_supabase

router = APIRouter()

# Initialize service
assessment_service = ConversationalAssessmentService()


class AssessmentRequest(BaseModel):
    """Request model for assessment message."""
    message: str = Field(..., description="User's message")
    session_id: Optional[str] = Field(None, description="Session ID (optional, for continuing conversation)")
    user_id: Optional[str] = Field("web", description="User ID")


class StartAssessmentRequest(BaseModel):
    """Request model to start a new assessment."""
    user_id: Optional[str] = Field("web", description="User ID")


class AssessmentResponse(BaseModel):
    """Response model for assessment."""
    response: str = Field(..., description="Assistant's response")
    current_turn: int = Field(..., description="Current turn number (1-4)")
    next_turn: Optional[int] = Field(None, description="Next turn number (null if complete)")
    is_complete: bool = Field(..., description="Whether assessment is complete")
    session_id: str = Field(..., description="Session ID")
    skill_profile: Optional[Dict[str, Any]] = Field(None, description="Extracted skill profile (only when complete)")


class SkillProfileSchema(BaseModel):
    """Pydantic model for SkillProfileSchema."""
    user_id: str
    raw_job_title: str
    raw_experience_summary: str
    extraction_timestamp: str
    extracted_skills: List[Dict[str, Any]]


def save_skill_profile_to_database(
    user_id: str,
    session_id: str,
    skill_profile: Dict[str, Any],
    conversation_messages: List[Dict[str, str]]
) -> Dict[str, Any]:
    """
    Save skill profile and assessment session to database.
    
    Saves to:
    1. assessment_sessions table - conversation history and extracted skills
    2. user_profiles table - transforms and saves skills in standard format
    """
    supabase = get_supabase()
    
    try:
        # 1. Save assessment session
        session_data = {
            'id': session_id,
            'user_id': user_id,
            'messages': conversation_messages,
            'extracted_skills': skill_profile.get('extracted_skills', []),
            'status': 'completed',
            'updated_at': datetime.utcnow().isoformat()
        }
        
        # Check if session exists
        existing_session = supabase.table('assessment_sessions').select('id').eq('id', session_id).execute()
        
        if existing_session.data and len(existing_session.data) > 0:
            # Update existing session
            supabase.table('assessment_sessions').update(session_data).eq('id', session_id).execute()
        else:
            # Create new session
            session_data['created_at'] = datetime.utcnow().isoformat()
            supabase.table('assessment_sessions').insert(session_data).execute()
        
        # 2. Transform and save to user_profiles
        # Extract skill names and preserve structure
        skills_list = []
        tools_list = []
        certifications_list = []
        # Store detailed skill data with O*NET codes for future use
        detailed_skills = []
        
        for skill_obj in skill_profile.get('extracted_skills', []):
            category = skill_obj.get('category', '')
            user_phrase = skill_obj.get('user_phrase', '')
            onet_codes = skill_obj.get('onet_task_codes', [])
            
            # Add skill name (from user_phrase) to simple list
            if user_phrase:
                skills_list.append(user_phrase)
            
            # Preserve detailed structure with O*NET codes
            detailed_skills.append({
                'category': category,
                'user_phrase': user_phrase,
                'onet_task_codes': onet_codes
            })
            
            # Extract tools from category or phrase
            if 'tool' in user_phrase.lower() or 'Tool' in category or any('Tool' in code for code in onet_codes):
                tools_list.append(user_phrase)
        
        # Build profile payload
        profile_data = {
            'user_id': user_id,
            'skills': skills_list,  # Simple list for backward compatibility
            'tools': tools_list,
            'certifications': certifications_list,
            'work_experience': skill_profile.get('raw_experience_summary', ''),
            'updated_at': datetime.utcnow().isoformat(),
            # Store detailed skill data with O*NET codes in a metadata field
            # Note: This requires adding a metadata JSONB column to user_profiles if it doesn't exist
        }
        
        # Try to save detailed skills in a metadata field if available
        # Check if metadata column exists by trying to use it
        try:
            # Store full skill profile data including O*NET codes
            profile_data['metadata'] = {
                'assessment_source': 'conversational',
                'raw_job_title': skill_profile.get('raw_job_title', ''),
                'extraction_timestamp': skill_profile.get('extraction_timestamp', ''),
                'detailed_skills': detailed_skills,
                'onet_codes': [code for skill in detailed_skills for code in skill.get('onet_task_codes', [])]
            }
        except Exception:
            # If metadata column doesn't exist, continue without it
            pass
        
        # Check if profile exists
        existing_profile = supabase.table('user_profiles').select('user_id').eq('user_id', user_id).execute()
        
        if existing_profile.data and len(existing_profile.data) > 0:
            # Update existing profile - merge with existing skills
            current_profile = supabase.table('user_profiles').select('*').eq('user_id', user_id).execute()
            if current_profile.data:
                current_skills = current_profile.data[0].get('skills', []) or []
                current_tools = current_profile.data[0].get('tools', []) or []
                
                # Merge skills (avoid duplicates)
                merged_skills = list(set(current_skills + skills_list))
                merged_tools = list(set(current_tools + tools_list))
                
                profile_data['skills'] = merged_skills
                profile_data['tools'] = merged_tools
                
                # Update profile
                supabase.table('user_profiles').update(profile_data).eq('user_id', user_id).execute()
        else:
            # Create new profile
            profile_data['created_at'] = datetime.utcnow().isoformat()
            supabase.table('user_profiles').insert(profile_data).execute()
        
        return {
            'session_saved': True,
            'profile_saved': True,
            'session_id': session_id,
            'user_id': user_id
        }
        
    except Exception as e:
        # Log error but don't fail the request
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to save skill profile to database: {e}", exc_info=True)
        return {
            'session_saved': False,
            'profile_saved': False,
            'error': str(e)
        }


@router.post("/assess/conversation", response_model=AssessmentResponse)
async def assess_conversation(request: AssessmentRequest):
    """
    Process a message in the conversational skill assessment.
    
    This endpoint handles the 4-turn dialogue flow:
    - Turn 1: Professional Identity & Scope
    - Turn 2: Mechanical & Hydraulic
    - Turn 3: Electrical & Diagnostics
    - Turn 4: Safety, Leadership, & Compliance
    """
    try:
        # Get or create session
        session = session_manager.get_session(
            user_id=request.user_id,
            session_id=request.session_id
        )
        
        # Add user message to session
        session.add_message("user", request.message)
        
        # Process message with assessment service
        result = await assessment_service.process_message(
            user_message=request.message,
            conversation_history=session.messages[:-1],  # Exclude just-added user message
            current_turn=session.current_turn,
            user_id=request.user_id,
            session_id=session.session_id
        )
        
        # Add assistant response to session
        session.add_message("assistant", result["response"])
        
        # Update turn if needed
        skill_profile = result.get("skill_profile")
        if result.get("is_complete"):
            session.complete(skill_profile)
            
            # Save to database when assessment is complete
            if skill_profile:
                save_result = save_skill_profile_to_database(
                    user_id=request.user_id,
                    session_id=session.session_id,
                    skill_profile=skill_profile,
                    conversation_messages=session.messages
                )
                # Log save result (for debugging)
                import logging
                logger = logging.getLogger(__name__)
                if save_result.get('session_saved') and save_result.get('profile_saved'):
                    logger.info(f"Skill profile saved successfully for user {request.user_id}")
                else:
                    logger.warning(f"Failed to save skill profile: {save_result.get('error')}")
        elif result.get("next_turn"):
            session.advance_turn()
        
        return AssessmentResponse(
            response=result["response"],
            current_turn=result.get("current_turn", session.current_turn),
            next_turn=result.get("next_turn"),
            is_complete=result.get("is_complete", False),
            session_id=session.session_id,
            skill_profile=skill_profile
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Assessment error: {str(e)}")


@router.post("/assess/start", response_model=AssessmentResponse)
async def start_assessment(request: StartAssessmentRequest):
    """
    Start a new conversational skill assessment session.
    
    Returns the initial welcome message (Turn 1 prompt).
    """
    try:
        # Create new session
        session = session_manager.get_session(user_id=request.user_id)
        
        # Get initial message
        initial_message = assessment_service.get_initial_message()
        
        # Add initial assistant message to session
        session.add_message("assistant", initial_message)
        
        return AssessmentResponse(
            response=initial_message,
            current_turn=1,
            next_turn=2,
            is_complete=False,
            session_id=session.session_id,
            skill_profile=None
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start assessment: {str(e)}")


@router.get("/assess/session/{session_id}")
async def get_session(session_id: str, user_id: str = "web"):
    """Get session details."""
    try:
        session = session_manager.get_session(user_id=user_id, session_id=session_id)
        return {
            "session": session.to_dict(),
            "messages": session.messages,
            "skill_profile": session.skill_profile
        }
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except KeyError:
        raise HTTPException(status_code=404, detail="Session not found")


@router.delete("/assess/session/{session_id}")
async def delete_session(session_id: str, user_id: str = "web"):
    """Delete a session."""
    try:
        session = session_manager.get_session(user_id=user_id, session_id=session_id)
        session_manager.delete_session(session_id)
        return {"message": "Session deleted", "session_id": session_id}
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except KeyError:
        raise HTTPException(status_code=404, detail="Session not found")


@router.get("/assess/turn-prompt/{turn}")
async def get_turn_prompt(turn: int):
    """Get the prompt for a specific turn (for reference)."""
    if turn < 1 or turn > 4:
        raise HTTPException(status_code=400, detail="Turn must be between 1 and 4")
    
    return {
        "turn": turn,
        "prompt": TURN_PROMPTS.get(turn),
        "focus_area": {
            1: "Professional Identity & Scope",
            2: "Mechanical & Hydraulic",
            3: "Electrical & Diagnostics",
            4: "Safety, Leadership, & Compliance"
        }.get(turn)
    }


@router.get("/profile/{user_id}")
async def get_user_skill_profile(user_id: str):
    """
    Get user's skill profile from the database.
    Returns the most recent assessment session's skill profile.
    """
    try:
        supabase = get_supabase()
        
        # Get the most recent completed assessment session
        # Order by updated_at descending to get the most recent first
        all_sessions = supabase.table('assessment_sessions').select('*').eq('user_id', user_id).eq('status', 'completed').execute()
        
        # Sort manually by updated_at descending and take the first one
        if all_sessions.data and len(all_sessions.data) > 0:
            sorted_sessions = sorted(
                all_sessions.data,
                key=lambda x: x.get('updated_at', ''),
                reverse=True
            )
            session = sorted_sessions[0]
            
            # Get user profile for additional data
            profile = supabase.table('user_profiles').select('*').eq('user_id', user_id).execute()
            
            return {
                "has_assessment": True,
                "session_id": session.get('id'),
                "extracted_skills": session.get('extracted_skills', []),
                "messages": session.get('messages', []),
                "updated_at": session.get('updated_at'),
                "user_profile": profile.data[0] if profile.data and len(profile.data) > 0 else None
            }
        else:
            # Check if user has a profile but no assessment
            profile = supabase.table('user_profiles').select('*').eq('user_id', user_id).execute()
            
            return {
                "has_assessment": False,
                "user_profile": profile.data[0] if profile.data and len(profile.data) > 0 else None
            }
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(f"Error fetching skill profile: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch skill profile: {str(e)}")

