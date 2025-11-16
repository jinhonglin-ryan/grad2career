"""
API Routes for Conversational Skill Assessment
"""
import logging
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.services.conversational_assessment import (
    ConversationalAssessmentService,
    TURN_PROMPTS
)
from app.services.session_manager import session_manager
from app.services.mining_skill_mapper import extract_transferable_skills
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
        
        # Build profile payload (without metadata to avoid schema issues)
        profile_data = {
            'user_id': user_id,
            'skills': skills_list,  # Simple list for backward compatibility
            'tools': tools_list,
            'certifications': certifications_list,
            'work_experience': skill_profile.get('raw_experience_summary', ''),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        # Note: Detailed skills with O*NET codes are already saved in assessment_sessions table
        # We don't need to duplicate them in user_profiles.metadata
        
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


@router.delete("/clear-assessment")
async def clear_assessment(request: Request):
    """
    Clear user's previous assessment data to allow retaking.
    This deletes assessment sessions and clears skill profile data.
    """
    # Get user from JWT token
    from app.api.routes.auth import verify_jwt_token
    
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    token = auth_header.replace('Bearer ', '')
    payload = verify_jwt_token(token)
    user_id = payload['user_id']
    
    supabase = get_supabase()
    
    try:
        # Delete all assessment sessions for this user
        supabase.table('assessment_sessions').delete().eq('user_id', user_id).execute()
        
        # Clear skill profile data in user_profiles
        # Keep the profile record but clear skills-related fields
        supabase.table('user_profiles').update({
            'skills': None,
            'tools': None,
            'updated_at': datetime.utcnow().isoformat()
        }).eq('user_id', user_id).execute()
        
        # Also clear any mining questionnaire responses
        supabase.table('mining_questionnaire_responses').delete().eq('user_id', user_id).execute()
        
        return {
            "message": "Assessment data cleared successfully",
            "user_id": user_id
        }
    except Exception as e:
        logging.error(f"Error clearing assessment data: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear assessment data: {str(e)}")


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


@router.post("/save")
async def save_skill_profile(request: Dict[str, Any]):
    """
    Manually save or update a skill profile.
    This is called when user explicitly wants to save their assessment.
    """
    try:
        user_id = request.get('user_id')
        skill_profile = request.get('skill_profile')
        
        if not user_id or not skill_profile:
            raise HTTPException(status_code=400, detail="user_id and skill_profile are required")
        
        supabase = get_supabase()
        
        # Extract skills from profile
        skills_list = []
        tools_list = []
        
        for skill_obj in skill_profile.get('extracted_skills', []):
            user_phrase = skill_obj.get('user_phrase', '')
            if user_phrase:
                skills_list.append(user_phrase)
                # Extract tools if category indicates it
                if 'tool' in user_phrase.lower():
                    tools_list.append(user_phrase)
        
        # Build profile data (without metadata to avoid schema issues)
        profile_data = {
            'user_id': user_id,
            'skills': skills_list,
            'tools': tools_list,
            'certifications': [],
            'work_experience': skill_profile.get('raw_experience_summary', ''),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        # Check if profile exists
        existing_profile = supabase.table('user_profiles').select('user_id').eq('user_id', user_id).execute()
        
        if existing_profile.data and len(existing_profile.data) > 0:
            # Update existing profile
            supabase.table('user_profiles').update(profile_data).eq('user_id', user_id).execute()
        else:
            # Create new profile
            profile_data['created_at'] = datetime.utcnow().isoformat()
            supabase.table('user_profiles').insert(profile_data).execute()
        
        return {
            "success": True,
            "message": "Skill profile saved successfully",
            "user_id": user_id
        }
        
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(f"Error saving skill profile: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to save skill profile: {str(e)}")


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


class MiningQuestionnaireRequest(BaseModel):
    """Request model for mining questionnaire."""
    user_id: str = Field(..., description="User ID")
    last_mining_job_title: Optional[str] = Field(None, description="Last mining job title")
    years_experience: Optional[int] = Field(None, description="Years of mining experience")
    mining_type: Optional[str] = Field(None, description="Mining type: underground, surface, or both")
    operated_heavy_machinery: bool = Field(False, description="Whether user operated heavy machinery")
    machinery_types: List[str] = Field(default_factory=list, description="Types of machinery operated")
    performed_maintenance: bool = Field(False, description="Whether user performed maintenance")
    maintenance_types: List[str] = Field(default_factory=list, description="Types of maintenance performed")
    safety_training_completed: bool = Field(False, description="Whether user completed safety training")
    safety_certifications: List[str] = Field(default_factory=list, description="Safety certifications (MSHA, OSHA, etc.)")
    supervised_team: bool = Field(False, description="Whether user supervised a team")
    team_size: Optional[int] = Field(None, description="Size of team supervised")
    welding_experience: bool = Field(False, description="Whether user has welding experience")
    electrical_work: bool = Field(False, description="Whether user performed electrical work")
    blasting_experience: bool = Field(False, description="Whether user has blasting experience")
    cdl_license: bool = Field(False, description="Whether user has CDL license")


@router.post("/assess/questionnaire")
async def submit_mining_questionnaire(request: MiningQuestionnaireRequest):
    """
    Submit mining-specific questionnaire and extract transferable skills.
    
    This is the recommended assessment method for coal miners.
    """
    try:
        supabase = get_supabase()
        
        # Convert request to dictionary for processing
        questionnaire_data = request.model_dump()
        
        # Extract transferable skills from questionnaire
        transferable_skills = extract_transferable_skills(questionnaire_data)
        
        # Create a session ID for this assessment
        import uuid
        session_id = str(uuid.uuid4())
        
        # Save questionnaire responses to mining_questionnaire_responses table
        questionnaire_response_data = {
            'id': session_id,
            'user_id': request.user_id,
            'last_mining_job_title': request.last_mining_job_title,
            'years_experience': request.years_experience,
            'mining_type': request.mining_type,
            'operated_heavy_machinery': request.operated_heavy_machinery,
            'machinery_types': request.machinery_types,
            'performed_maintenance': request.performed_maintenance,
            'maintenance_types': request.maintenance_types,
            'safety_training_completed': request.safety_training_completed,
            'safety_certifications': request.safety_certifications,
            'supervised_team': request.supervised_team,
            'team_size': request.team_size,
            'welding_experience': request.welding_experience,
            'electrical_work': request.electrical_work,
            'blasting_experience': request.blasting_experience,
            'cdl_license': request.cdl_license,
            'questionnaire_data': questionnaire_data,
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        # Also create an assessment session for consistency
        assessment_session_data = {
            'id': session_id,
            'user_id': request.user_id,
            'messages': [
                {"role": "system", "content": "Mining questionnaire completed"},
                {"role": "user", "content": f"Completed questionnaire: {request.last_mining_job_title or 'Mining professional'}"}
            ],
            'extracted_skills': [
                {
                    "category": "Mining Skills",
                    "user_phrase": skill,
                    "onet_task_codes": []
                }
                for skill in transferable_skills
            ],
            'status': 'completed',
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        try:
            # Save questionnaire responses
            supabase.table('mining_questionnaire_responses').insert(questionnaire_response_data).execute()
        except Exception as e:
            logger.warning(f"Could not save to mining_questionnaire_responses (table may not exist yet): {e}")
        
        try:
            # Save assessment session
            supabase.table('assessment_sessions').insert(assessment_session_data).execute()
        except Exception as e:
            logger.warning(f"Could not save assessment session: {e}")
        
        # Update user profile with mining-specific data and skills
        profile_data = {
            'user_id': request.user_id,
            'skills': transferable_skills,
            'tools': request.machinery_types + (request.maintenance_types if request.performed_maintenance else []),
            'certifications': request.safety_certifications,
            'previous_job_title': request.last_mining_job_title,
            'mining_role': _determine_mining_role(request.last_mining_job_title),
            'mining_type': request.mining_type,
            'years_mining_experience': request.years_experience,
            'mining_questionnaire_responses': questionnaire_data,
            'work_experience': _generate_work_experience_summary(request),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        # Check if profile exists
        existing_profile = supabase.table('user_profiles').select('user_id').eq('user_id', request.user_id).execute()
        
        if existing_profile.data and len(existing_profile.data) > 0:
            # Update existing profile
            supabase.table('user_profiles').update(profile_data).eq('user_id', request.user_id).execute()
        else:
            # Create new profile
            profile_data['created_at'] = datetime.utcnow().isoformat()
            supabase.table('user_profiles').insert(profile_data).execute()
        
        return {
            "success": True,
            "session_id": session_id,
            "transferable_skills": transferable_skills,
            "skill_count": len(transferable_skills),
            "message": "Questionnaire submitted successfully. Your skills have been extracted and saved."
        }
        
    except Exception as e:
        logger.error(f"Error processing mining questionnaire: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to process questionnaire: {str(e)}")


def _determine_mining_role(job_title: Optional[str]) -> Optional[str]:
    """Determine mining role category from job title."""
    if not job_title:
        return None
    
    job_lower = job_title.lower()
    if "operator" in job_lower or "driver" in job_lower:
        return "Operator"
    elif "maintenance" in job_lower or "technician" in job_lower or "electrician" in job_lower:
        return "Maintenance"
    elif "supervisor" in job_lower or "foreman" in job_lower or "manager" in job_lower:
        return "Supervisor"
    else:
        return "Other"


def _generate_work_experience_summary(request: MiningQuestionnaireRequest) -> str:
    """Generate a work experience summary from questionnaire data."""
    parts = []
    
    if request.last_mining_job_title:
        parts.append(f"Worked as {request.last_mining_job_title}")
    
    if request.years_experience:
        parts.append(f"for {request.years_experience} years")
    
    if request.mining_type:
        parts.append(f"in {request.mining_type} mining")
    
    if request.operated_heavy_machinery:
        if request.machinery_types:
            parts.append(f"Operated: {', '.join(request.machinery_types)}")
        else:
            parts.append("Operated heavy machinery")
    
    if request.performed_maintenance:
        if request.maintenance_types:
            parts.append(f"Performed maintenance on: {', '.join(request.maintenance_types)}")
        else:
            parts.append("Performed equipment maintenance")
    
    if request.safety_training_completed:
        if request.safety_certifications:
            parts.append(f"Safety certifications: {', '.join(request.safety_certifications)}")
        else:
            parts.append("Completed safety training")
    
    if request.supervised_team:
        if request.team_size:
            parts.append(f"Supervised team of {request.team_size}")
        else:
            parts.append("Supervised team")
    
    additional_skills = []
    if request.welding_experience:
        additional_skills.append("welding")
    if request.electrical_work:
        additional_skills.append("electrical work")
    if request.blasting_experience:
        additional_skills.append("blasting")
    if request.cdl_license:
        additional_skills.append("CDL license")
    
    if additional_skills:
        parts.append(f"Additional skills: {', '.join(additional_skills)}")
    
    return ". ".join(parts) + "." if parts else "Mining professional with experience in coal industry."

