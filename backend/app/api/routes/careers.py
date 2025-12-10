"""
API Routes for Career Matching (Coal Miner Focused)
"""
import logging
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.core.supabase import get_supabase
from app.services.mining_skill_mapper import map_mining_skills_to_career
from app.services.external_apis import careeronestop_search_training

router = APIRouter()
logger = logging.getLogger(__name__)


class CareerMatchResponse(BaseModel):
    """Response model for career matches."""
    careers: List[Dict[str, Any]]
    user_skills: List[str]
    total_matches: int


@router.get("/match", response_model=CareerMatchResponse)
async def get_career_matches(request: Request):
    """
    Get career matches for the current user based on their mining skills.
    
    Matches user's skills against curated target_careers table.
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
        # Get user profile with skills
        profile_result = supabase.table('user_profiles').select('*').eq('user_id', user_id).execute()
        if not profile_result.data or len(profile_result.data) == 0:
            raise HTTPException(status_code=404, detail="User profile not found. Please complete skill assessment first.")
        
        user_profile = profile_result.data[0]
        user_skills = user_profile.get('skills', []) or []
        
        # Get user metadata for location
        user_result = supabase.table('users').select('metadata').eq('id', user_id).execute()
        user_metadata = {}
        if user_result.data and len(user_result.data) > 0:
            user_metadata = user_result.data[0].get('metadata', {}) or {}
        
        user_state = user_metadata.get('state')
        # State is now directly stored (west_virginia, kentucky, pennsylvania)
        
        # Get all target careers
        careers_result = supabase.table('target_careers').select('*').execute()
        if not careers_result.data:
            logger.warning("No target careers found in database. Using fallback.")
            # Return empty or use fallback
            return CareerMatchResponse(
                careers=[],
                user_skills=user_skills,
                total_matches=0
            )
        
        target_careers = careers_result.data
        
        # Match user skills to each target career
        matched_careers = []
        for career in target_careers:
            match_result = map_mining_skills_to_career(user_skills, career)
            
            # Only include careers with match score > 30%
            if match_result["match_score"] >= 30:
                career_match = {
                    "id": career.get("id"),
                    "career_title": career.get("career_title"),
                    "description": career.get("description", ""),
                    "category": career.get("category", ""),
                    "match_score": match_result["match_score"],
                    "transferable_skills": match_result["transferable_skills"],
                    "matching_required_skills": match_result["matching_required_skills"],
                    "missing_skills": match_result["missing_skills"],
                    "salary_range": career.get("median_salary_range", ""),
                    "growth_rate": career.get("national_growth_rate", ""),
                    "appalachian_demand_rating": career.get("appalachian_demand_rating", ""),
                    "appalachian_states": career.get("appalachian_states", []),
                    "required_certifications": career.get("required_certifications", []),
                    "entry_level_education": career.get("entry_level_education", ""),
                    # Location context (simplified - would use Google Maps API in production)
                    "local_demand_rating": career.get("appalachian_demand_rating", ""),
                    "commute_distance_miles": None,  # Would calculate with Google Maps
                    "commute_time_minutes": None,
                    "local_job_growth": f"High demand in {', '.join(career.get('appalachian_states', []))}"
                }
                
                matched_careers.append(career_match)
        
        # Sort by match score (highest first)
        matched_careers.sort(key=lambda x: x["match_score"], reverse=True)
        
        # Save top matches to career_matches table
        for i, match in enumerate(matched_careers[:5]):  # Save top 5
            try:
                match_data = {
                    "user_id": user_id,
                    "career_title": match["career_title"],
                    "match_score": match["match_score"],
                    "required_skills": match["matching_required_skills"],
                    "missing_skills": match["missing_skills"],
                    "salary_range": match["salary_range"],
                    "growth_rate": match["growth_rate"],
                    "local_demand_rating": match["local_demand_rating"],
                    "commute_distance_miles": match["commute_distance_miles"],
                    "commute_time_minutes": match["commute_time_minutes"],
                    "local_job_growth": match["local_job_growth"],
                    "created_at": datetime.utcnow().isoformat()
                }
                
                # Check if match already exists
                existing = supabase.table('career_matches')\
                    .select('id')\
                    .eq('user_id', user_id)\
                    .eq('career_title', match["career_title"])\
                    .execute()
                
                if existing.data and len(existing.data) > 0:
                    # Update existing
                    supabase.table('career_matches')\
                        .update(match_data)\
                        .eq('id', existing.data[0]['id'])\
                        .execute()
                else:
                    # Create new
                    supabase.table('career_matches').insert(match_data).execute()
            except Exception as e:
                logger.error(f"Error saving career match: {e}")
                # Continue even if save fails
        
        return CareerMatchResponse(
            careers=matched_careers,
            user_skills=user_skills,
            total_matches=len(matched_careers)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching career matches: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch career matches: {str(e)}")


@router.get("/target-careers")
async def get_target_careers():
    """Get all available target careers (for reference)."""
    supabase = get_supabase()
    
    try:
        result = supabase.table('target_careers').select('*').order('career_title').execute()
        return {
            "success": True,
            "careers": result.data or []
        }
    except Exception as e:
        logger.error(f"Error fetching target careers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/target-careers/skills")
async def get_career_skills(career_title: str):
    """Get required skills for a specific career by title."""
    supabase = get_supabase()
    
    try:
        # Search for career by title (case-insensitive)
        result = supabase.table('target_careers')\
            .select('career_title, required_skills, transferable_mining_skills')\
            .ilike('career_title', f'%{career_title}%')\
            .limit(1)\
            .execute()
        
        if not result.data or len(result.data) == 0:
            # Try exact match
            result = supabase.table('target_careers')\
                .select('career_title, required_skills, transferable_mining_skills')\
                .eq('career_title', career_title)\
                .execute()
        
        if not result.data or len(result.data) == 0:
            return {
                "success": True,
                "career_title": career_title,
                "required_skills": [],
                "transferable_mining_skills": [],
                "found": False
            }
        
        career = result.data[0]
        return {
            "success": True,
            "career_title": career.get("career_title"),
            "required_skills": career.get("required_skills", []) or [],
            "transferable_mining_skills": career.get("transferable_mining_skills", []) or [],
            "found": True
        }
    except Exception as e:
        logger.error(f"Error fetching career skills: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class TrainingProgramsRequest(BaseModel):
    """Request model for fetching training programs."""
    career_title: str
    career_id: Optional[str] = None
    occupation_code: Optional[str] = None  # O*NET-SOC code if available
    skills: Optional[List[str]] = []  # Relevant skills for filtering
    zip_code: Optional[str] = None  # User's zip code
    max_results: int = 20


class SelectTrainingProgramsRequest(BaseModel):
    """Request model for selecting training programs."""
    career_id: str
    career_title: str
    selected_programs: List[Dict[str, Any]]  # List of selected program objects


@router.post("/training-programs")
async def get_training_programs(
    request_body: TrainingProgramsRequest,
    request: Request
):
    """
    Fetch training programs from CareerOneStop based on job position, skills, and location.
    
    This endpoint:
    1. Takes the career title/occupation and user's zip code
    2. Searches CareerOneStop API for relevant training programs
    3. Returns programs that match the user's needs and location
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
        # State to default zip code mapping (using central/major city in each state)
        STATE_ZIP_MAP = {
            'west_virginia': '25301',  # Charleston, WV
            'kentucky': '40502',        # Lexington, KY
            'pennsylvania': '15219',    # Pittsburgh, PA
        }
        
        # Get user metadata for location if not provided
        zip_code = request_body.zip_code
        if not zip_code:
            user_result = supabase.table('users').select('metadata').eq('id', user_id).execute()
            if user_result.data and len(user_result.data) > 0:
                user_metadata = user_result.data[0].get('metadata', {}) or {}
                # Try to get state and convert to zip code
                user_state = user_metadata.get('state')
                if user_state:
                    zip_code = STATE_ZIP_MAP.get(user_state)
        
        if not zip_code:
            raise HTTPException(
                status_code=400, 
                detail="Location is required. Please provide a ZIP code or complete your profile with a state."
            )
        
        # Use career title as occupation keyword if no occupation code provided
        # CareerOneStop API accepts occupation names/keywords or O*NET-SOC codes
        occupation = request_body.occupation_code or request_body.career_title
        
        # Search CareerOneStop for training programs
        logger.info(f"Searching CareerOneStop for occupation='{occupation}', location='{zip_code}'")
        result = careeronestop_search_training(
            occupation=occupation,
            location=zip_code,
            max_results=request_body.max_results
        )
        
        if result["status"] == "error":
            logger.warning(f"CareerOneStop API error: {result.get('error_message')}")
            # Return empty list instead of error - API might not be configured
            return {
                "success": True,
                "programs": [],
                "message": result.get("error_message", "Training programs unavailable"),
                "source": "careeronestop"
            }
        
        programs = result.get("programs", [])
        
        # Also check local_training_programs table for additional programs
        local_programs = []
        if request_body.career_id:
            try:
                # Get target career to find related local programs
                career_result = supabase.table('target_careers')\
                    .select('*')\
                    .eq('id', request_body.career_id)\
                    .execute()
                
                if career_result.data:
                    # Search local programs by zip code and career relevance
                    local_result = supabase.table('local_training_programs')\
                        .select('*')\
                        .eq('zip_code', zip_code)\
                        .eq('active', True)\
                        .limit(10)\
                        .execute()
                    
                    local_programs = local_result.data or []
            except Exception as e:
                logger.warning(f"Error fetching local training programs: {e}")
        
        return {
            "success": True,
            "programs": programs,
            "local_programs": local_programs,
            "total": len(programs) + len(local_programs),
            "source": "careeronestop",
            "location": zip_code,
            "occupation": occupation
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching training programs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch training programs: {str(e)}")


@router.post("/training-programs/select")
async def select_training_programs(
    request_body: SelectTrainingProgramsRequest,
    request: Request
):
    """
    Save user's selected training programs for a career.
    
    This allows users to select which training programs they want to participate in,
    which will then be considered by the learning path generating agent.
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
        # Store selected programs in user metadata or a dedicated table
        # For now, we'll store in user_profiles.selected_training_programs
        # In the future, could create a dedicated user_selected_programs table
        
        profile_result = supabase.table('user_profiles')\
            .select('*')\
            .eq('user_id', user_id)\
            .execute()
        
        if not profile_result.data or len(profile_result.data) == 0:
            raise HTTPException(status_code=404, detail="User profile not found")
        
        # Update user profile with selected programs
        selected_data = {
            "career_id": request_body.career_id,
            "career_title": request_body.career_title,
            "selected_programs": request_body.selected_programs,
            "selected_at": datetime.utcnow().isoformat()
        }
        
        # Get existing selected programs or initialize
        existing_profile = profile_result.data[0]
        existing_selected = existing_profile.get('selected_training_programs', []) or []
        
        # Add or update selection for this career
        updated_selected = [
            s for s in existing_selected 
            if s.get('career_id') != request_body.career_id
        ]
        updated_selected.append(selected_data)
        
        # Update profile
        supabase.table('user_profiles')\
            .update({
                'selected_training_programs': updated_selected,
                'updated_at': datetime.utcnow().isoformat()
            })\
            .eq('user_id', user_id)\
            .execute()
        
        logger.info(f"User {user_id} selected {len(request_body.selected_programs)} programs for career {request_body.career_title}")
        
        return {
            "success": True,
            "message": f"Selected {len(request_body.selected_programs)} training programs",
            "selected_programs": request_body.selected_programs
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving selected training programs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to save selected programs: {str(e)}")

