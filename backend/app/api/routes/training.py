"""
Training program recommendation routes for coal miners transitioning to renewable energy.

Uses real-time Google Search (Serper API) + OpenAI to find and extract training programs.
"""

import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from app.core.supabase import get_supabase
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


class CoalMinerTrainingRequest(BaseModel):
    """Request model for coal miner training recommendations"""
    user_id: Optional[str] = None  # Optional, will be extracted from JWT
    state: Optional[str] = None     # If not provided, will use user's profile state
    max_results: int = 20


class TrainingProgram(BaseModel):
    """Training program details"""
    program_name: str
    provider: str
    location: Optional[str] = None
    duration: Optional[str] = None
    cost: Optional[str] = None
    description: Optional[str] = None
    url: Optional[str] = None
    is_coal_miner_specific: bool = False
    match_score: float = 0.0
    relevance_reason: Optional[str] = None


class TrainingRecommendationResponse(BaseModel):
    """Response model for training recommendations"""
    success: bool
    user_state: str
    coal_miner_specific_programs: List[Dict[str, Any]]
    general_renewable_programs: List[Dict[str, Any]]
    total_programs: int
    search_details: Dict[str, Any]
    message: str


# Keywords for coal miner specific programs
COAL_MINER_KEYWORDS = [
    "coal miner",
    "coal worker",
    "mining transition",
    "displaced miner",
    "coal community",
    "mine worker retraining",
    "appalachian transition"
]

# Keywords for renewable energy programs
RENEWABLE_ENERGY_KEYWORDS = [
    "solar",
    "wind",
    "renewable energy",
    "clean energy",
    "photovoltaic",
    "wind turbine",
    "solar installer",
    "solar technician",
    "renewable technician"
]


def calculate_relevance_score(program: Dict[str, Any], user_data: Dict[str, Any]) -> float:
    """
    Calculate how relevant a training program is to the user.
    
    Factors:
    - Coal miner specific: +50 points
    - Renewable energy focus: +30 points
    - Location match: +20 points
    - Budget compatibility: +10 points
    - Schedule compatibility: +10 points
    """
    score = 0.0
    
    program_name = (program.get('program_name') or '').lower()
    program_desc = (program.get('description') or '').lower()
    program_text = f"{program_name} {program_desc}"
    
    # Check for coal miner specific keywords
    if any(keyword in program_text for keyword in COAL_MINER_KEYWORDS):
        score += 50
        program['is_coal_miner_specific'] = True
    
    # Check for renewable energy keywords
    if any(keyword in program_text for keyword in RENEWABLE_ENERGY_KEYWORDS):
        score += 30
    
    # Location match (if location data is available)
    user_state = user_data.get('state', '')
    program_location = (program.get('location') or '').lower()
    if user_state and user_state.replace('_', ' ') in program_location:
        score += 20
    
    # Budget compatibility
    budget = user_data.get('budget_constraint', '')
    cost = (program.get('cost') or '').lower()
    if budget == 'free' and ('free' in cost or 'grant' in cost or 'funded' in cost):
        score += 10
    
    # Normalize score to 0-100
    return min(score / 120 * 100, 100)


def filter_and_rank_programs(
    programs: List[Dict[str, Any]], 
    user_data: Dict[str, Any]
) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Filter and rank programs into coal-miner-specific and general renewable categories.
    
    Returns:
        Tuple of (coal_miner_programs, general_renewable_programs)
    """
    coal_miner_programs = []
    general_renewable_programs = []
    
    for program in programs:
        # Calculate relevance score
        score = calculate_relevance_score(program, user_data)
        program['match_score'] = score
        
        # Add relevance reason
        reasons = []
        program_text = f"{program.get('program_name') or ''} {program.get('description') or ''}".lower()
        
        if program.get('is_coal_miner_specific'):
            reasons.append("Designed for coal miners")
        if any(keyword in program_text for keyword in RENEWABLE_ENERGY_KEYWORDS):
            reasons.append("Renewable energy focused")
        
        program['relevance_reason'] = ", ".join(reasons) if reasons else "General training program"
        
        # Categorize
        if program.get('is_coal_miner_specific'):
            coal_miner_programs.append(program)
        else:
            general_renewable_programs.append(program)
    
    # Sort by match score
    coal_miner_programs.sort(key=lambda x: x['match_score'], reverse=True)
    general_renewable_programs.sort(key=lambda x: x['match_score'], reverse=True)
    
    return coal_miner_programs, general_renewable_programs


async def get_programs_from_database(supabase, user_state: str) -> List[Dict[str, Any]]:
    """
    Fetch training programs from database for a specific state.
    """
    try:
        result = supabase.table('training_programs').select('*').eq(
            'state', user_state
        ).eq('is_active', True).execute()
        
        if result.data:
            logger.info(f"Found {len(result.data)} cached programs in database for {user_state}")
            programs = []
            for record in result.data:
                programs.append({
                    'program_name': record.get('program_name', ''),
                    'provider': record.get('provider', ''),
                    'location': record.get('location', ''),
                    'duration': record.get('duration', ''),
                    'cost': record.get('cost', ''),
                    'description': record.get('description', ''),
                    'url': record.get('url', ''),
                    'is_coal_miner_specific': record.get('is_coal_miner_specific', False),
                })
            return programs
        return []
    except Exception as e:
        logger.error(f"Error fetching from database: {str(e)}")
        return []


async def save_programs_to_database(supabase, programs: List[Dict[str, Any]], user_state: str):
    """
    Save training programs to database.
    Updates existing or creates new.
    """
    try:
        for program in programs:
            program_name = program.get('program_name', '')
            if not program_name:
                continue
                
            # Check if exists
            existing = supabase.table('training_programs').select('id').eq(
                'program_name', program_name
            ).eq('state', user_state).execute()
            
            program_data = {
                'program_name': program_name,
                'provider': program.get('provider', ''),
                'state': user_state,
                'location': program.get('location', ''),
                'duration': program.get('duration', ''),
                'cost': program.get('cost', ''),
                'description': program.get('description', ''),
                'url': program.get('url', ''),
                'is_coal_miner_specific': program.get('is_coal_miner_specific', False),
                'source': 'serper_live_search',
                'is_active': True,
            }
            
            if existing.data:
                # Update existing
                supabase.table('training_programs').update(program_data).eq(
                    'id', existing.data[0]['id']
                ).execute()
            else:
                # Insert new
                supabase.table('training_programs').insert(program_data).execute()
        
        logger.info(f"Saved/updated {len(programs)} programs to database for {user_state}")
    except Exception as e:
        logger.error(f"Error saving to database: {str(e)}")
        # Don't fail request if save fails


@router.post("/coal-miner-training", response_model=TrainingRecommendationResponse)
async def get_coal_miner_training_programs(
    request_body: CoalMinerTrainingRequest,
    request: Request
):
    """
    Get training programs for coal miners (uses cached results if available).
    
    Strategy:
    1. Check database for cached results (fast, < 1 second)
    2. If no cache exists, perform live search (15-30 seconds)
    3. Save results to database for future use
    
    For fresh results, use /search-live-programs endpoint instead.
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
        # State mapping
        STATE_NAMES = {
            'west_virginia': 'West Virginia',
            'kentucky': 'Kentucky',
            'pennsylvania': 'Pennsylvania'
        }
        
        # Get user metadata
        user_result = supabase.table('users').select('metadata').eq('id', user_id).execute()
        user_metadata = {}
        if user_result.data and len(user_result.data) > 0:
            user_metadata = user_result.data[0].get('metadata', {}) or {}
        
        # Get user's state
        user_state = request_body.state or user_metadata.get('state')
        if not user_state:
            raise HTTPException(
                status_code=400,
                detail="State information required. Please complete your onboarding profile."
            )
        
        state_name = STATE_NAMES.get(user_state, user_state)
        
        # STEP 1: Try database first (fast)
        logger.info(f"Checking database for cached programs in {state_name}")
        programs_list = await get_programs_from_database(supabase, user_state)
        data_source = "cached"
        
        # STEP 2: If no cache, perform live search
        if not programs_list:
            logger.info(f"No cache found. Performing live search for {state_name}")
            
            # Check API keys
            if not settings.openai_api_key:
                raise HTTPException(status_code=503, detail="OpenAI API key not configured")
            if not settings.serper_api_key:
                raise HTTPException(status_code=503, detail="Serper API key not configured")
            
            # Import and use agent
            from app.services.agents.training_search_agent import TrainingSearchAgent
            
            agent = TrainingSearchAgent(openai_api_key=settings.openai_api_key)
            search_results = await agent.search_programs(
                state=user_state,
                max_programs=20,
                serper_key=settings.serper_api_key
            )
            
            if not search_results['success']:
                raise HTTPException(
                    status_code=503,
                    detail=search_results.get('message', 'Search failed')
                )
            
            programs_list = search_results.get('programs', [])
            data_source = "live_search"
            
            # Save to database for future use
            if programs_list:
                logger.info(f"Saving {len(programs_list)} programs to database")
                await save_programs_to_database(supabase, programs_list, user_state)
        else:
            logger.info(f"Using {len(programs_list)} cached programs")
        
        # Prepare user data for relevance scoring
        user_data = {
            'state': user_state,
            'budget_constraint': user_metadata.get('budget_constraint'),
            'scheduling': user_metadata.get('scheduling'),
            'target_sector': user_metadata.get('target_sector')
        }
        
        # Filter and rank programs
        coal_specific, general_renewable = filter_and_rank_programs(programs_list, user_data)
        
        # Limit results
        max_results = request_body.max_results
        coal_specific = coal_specific[:max_results]
        general_renewable = general_renewable[:max_results]
        
        total_programs = len(coal_specific) + len(general_renewable)
        
        # Prepare response message
        if data_source == "cached":
            message = f"Found {len(coal_specific)} coal miner-specific and {len(general_renewable)} general renewable energy programs in {state_name} (from cache)."
        else:
            message = f"✅ Live search complete! Found {len(coal_specific)} coal miner-specific and {len(general_renewable)} general renewable energy programs in {state_name}."
        
        if not programs_list:
            message = f"No programs found. Click 'Refresh Results' to search again."
        
        return TrainingRecommendationResponse(
            success=True,
            user_state=state_name,
            coal_miner_specific_programs=coal_specific,
            general_renewable_programs=general_renewable,
            total_programs=total_programs,
            search_details={
                'queries_used': [data_source],
                'state': state_name,
                'zip_code': 'N/A',
                'total_raw_results': len(programs_list),
                'unique_programs': len(programs_list),
                'data_source': data_source
            },
            message=message
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching training programs: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch training programs: {str(e)}"
        )


@router.post("/search-live-programs", response_model=TrainingRecommendationResponse)
async def force_live_search_training_programs(
    request_body: CoalMinerTrainingRequest,
    request: Request
):
    """
    Force a fresh live search (ignores cache).
    
    This endpoint ALWAYS performs real-time search:
    1. Bypasses database cache
    2. Searches Google using Serper API
    3. Extracts programs using OpenAI
    4. Updates database with fresh results
    
    Use this when user clicks "Refresh Results" button.
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
        # State mapping
        STATE_NAMES = {
            'west_virginia': 'West Virginia',
            'kentucky': 'Kentucky',
            'pennsylvania': 'Pennsylvania'
        }
        
        # Get user metadata
        user_result = supabase.table('users').select('metadata').eq('id', user_id).execute()
        user_metadata = {}
        if user_result.data and len(user_result.data) > 0:
            user_metadata = user_result.data[0].get('metadata', {}) or {}
        
        # Get user's state
        user_state = request_body.state or user_metadata.get('state')
        if not user_state:
            raise HTTPException(
                status_code=400,
                detail="State information required. Please complete your onboarding profile."
            )
        
        state_name = STATE_NAMES.get(user_state, user_state)
        
        logger.info(f"🔄 FORCE REFRESH: Live search for training programs in {state_name}")
        
        # Check API keys
        if not settings.openai_api_key:
            raise HTTPException(status_code=503, detail="OpenAI API key not configured")
        if not settings.serper_api_key:
            raise HTTPException(status_code=503, detail="Serper API key not configured")
        
        # Import and use agent
        from app.services.agents.training_search_agent import TrainingSearchAgent
        
        agent = TrainingSearchAgent(openai_api_key=settings.openai_api_key)
        search_results = await agent.search_programs(
            state=user_state,
            max_programs=20,
            serper_key=settings.serper_api_key
        )
        
        if not search_results['success']:
            raise HTTPException(
                status_code=503,
                detail=search_results.get('message', 'Search failed')
            )
        
        programs_list = search_results.get('programs', [])
        
        logger.info(f"Found {len(programs_list)} programs in live search")
        
        # Save/update database
        if programs_list:
            logger.info(f"Updating database with {len(programs_list)} programs")
            await save_programs_to_database(supabase, programs_list, user_state)
        
        # Prepare user data for relevance scoring
        user_data = {
            'state': user_state,
            'budget_constraint': user_metadata.get('budget_constraint'),
            'scheduling': user_metadata.get('scheduling'),
            'target_sector': user_metadata.get('target_sector')
        }
        
        # Filter and rank programs
        coal_specific, general_renewable = filter_and_rank_programs(programs_list, user_data)
        
        # Limit results
        max_results = request_body.max_results
        coal_specific = coal_specific[:max_results]
        general_renewable = general_renewable[:max_results]
        
        total_programs = len(coal_specific) + len(general_renewable)
        
        # Prepare response message
        message = f"🔄 Refreshed! Found {len(coal_specific)} coal miner-specific and {len(general_renewable)} general renewable energy programs in {state_name}."
        
        if not programs_list:
            message = f"No programs found in search. This might be due to limited results in {state_name}."
        
        return TrainingRecommendationResponse(
            success=True,
            user_state=state_name,
            coal_miner_specific_programs=coal_specific,
            general_renewable_programs=general_renewable,
            total_programs=total_programs,
            search_details={
                'queries_used': ['live_search_forced'],
                'state': state_name,
                'zip_code': 'N/A',
                'total_raw_results': len(programs_list),
                'unique_programs': len(programs_list),
                'data_source': 'live_search_refresh'
            },
            message=message
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in forced live search: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Live search failed: {str(e)}"
        )

