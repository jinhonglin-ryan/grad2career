"""
Training program recommendation routes for coal miners transitioning to renewable energy.

This module provides endpoints to find and recommend training programs specifically
designed for coal miners, or general renewable energy training programs.
"""

import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from app.core.supabase import get_supabase
from app.core.config import settings
from app.services.external_apis import careeronestop_search_training

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
    Returns programs from our curated database.
    """
    try:
        # Query training programs for the user's state
        result = supabase.table('training_programs').select('*').eq(
            'state', user_state
        ).eq('is_active', True).execute()
        
        if result.data:
            logger.info(f"Found {len(result.data)} programs in database for {user_state}")
            # Convert database records to our expected format
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
                    'program_type': record.get('program_type', ''),
                    'contact_email': record.get('contact_email'),
                    'contact_phone': record.get('contact_phone'),
                    'financial_aid_available': record.get('financial_aid_available', False),
                    'job_placement_assistance': record.get('job_placement_assistance', False),
                    'certification_provided': record.get('certification_provided'),
                })
            return programs
        else:
            logger.warning(f"No programs found in database for {user_state}")
            return []
    except Exception as e:
        logger.error(f"Error fetching programs from database: {str(e)}")
        return []


async def save_programs_to_database(supabase, programs: List[Dict[str, Any]], user_state: str):
    """
    Save training programs to database for future use.
    Only saves if program doesn't already exist.
    """
    try:
        for program in programs:
            # Check if program already exists
            existing = supabase.table('training_programs').select('id').eq(
                'program_name', program.get('program_name')
            ).eq('state', user_state).execute()
            
            if not existing.data:
                # Insert new program
                program_data = {
                    'program_name': program.get('program_name', ''),
                    'provider': program.get('provider', ''),
                    'state': user_state,
                    'location': program.get('location', ''),
                    'duration': program.get('duration', ''),
                    'cost': program.get('cost', ''),
                    'description': program.get('description', ''),
                    'url': program.get('url', ''),
                    'is_coal_miner_specific': program.get('is_coal_miner_specific', False),
                    'source': 'careeronestop',
                    'is_active': True,
                }
                supabase.table('training_programs').insert(program_data).execute()
        
        logger.info(f"Saved programs to database for {user_state}")
    except Exception as e:
        logger.error(f"Error saving programs to database: {str(e)}")
        # Don't fail the request if save fails


@router.post("/coal-miner-training", response_model=TrainingRecommendationResponse)
async def get_coal_miner_training_recommendations(
    request_body: CoalMinerTrainingRequest,
    request: Request
):
    """
    Find training programs for coal miners transitioning to renewable energy.
    
    Priority 1: Programs specifically designed for coal miners
    Priority 2: General renewable energy training programs
    
    Search is performed in the user's state (WV, KY, PA) or surrounding areas.
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
        # State to zip code mapping
        STATE_ZIP_MAP = {
            'west_virginia': '25301',  # Charleston, WV
            'kentucky': '40502',        # Lexington, KY
            'pennsylvania': '15219',    # Pittsburgh, PA
        }
        
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
        
        zip_code = STATE_ZIP_MAP.get(user_state)
        state_name = STATE_NAMES.get(user_state, user_state)
        
        logger.info(f"Searching training programs for coal miners in {state_name}")
        
        # Prepare user data for relevance scoring
        user_data = {
            'state': user_state,
            'budget_constraint': user_metadata.get('budget_constraint'),
            'scheduling': user_metadata.get('scheduling'),
            'target_sector': user_metadata.get('target_sector')
        }
        
        # STEP 1: Try to get programs from database first (fast, cached)
        logger.info(f"Fetching programs from database for {state_name}")
        programs_list = await get_programs_from_database(supabase, user_state)
        search_queries = ["database_cached"]
        all_programs = []  # Initialize for response tracking
        
        # STEP 2: If no programs in database, try CareerOneStop API
        if not programs_list:
            logger.info(f"No cached programs found. Searching CareerOneStop API for {state_name}")
            search_queries = []
            
            # Search 1: Coal miner specific renewable energy programs
            coal_miner_searches = [
                "coal miner renewable energy training",
                "coal worker transition clean energy",
                "mining to solar wind career"
            ]
            
            for query in coal_miner_searches:
                logger.info(f"Searching CareerOneStop: '{query}' in {state_name}")
                search_queries.append(query)
                result = careeronestop_search_training(
                    occupation=query,
                    location=zip_code,
                    max_results=10
                )
                
                if result["status"] == "success":
                    programs = result.get("programs", [])
                    all_programs.extend(programs)
            
            # Search 2: General renewable energy programs
            renewable_searches = [
                "solar installer certification",
                "wind turbine technician training",
                "renewable energy technician",
                "solar panel installation",
                "clean energy jobs training"
            ]
            
            for query in renewable_searches:
                logger.info(f"Searching CareerOneStop: '{query}' in {state_name}")
                search_queries.append(query)
                result = careeronestop_search_training(
                    occupation=query,
                    location=zip_code,
                    max_results=10
                )
                
                if result["status"] == "success":
                    programs = result.get("programs", [])
                    all_programs.extend(programs)
            
            # Remove duplicates based on program name
            unique_programs = {}
            for program in all_programs:
                program_name = program.get('program_name', program.get('ProgramName', ''))
                if program_name and program_name not in unique_programs:
                    # Normalize program structure
                    normalized_program = {
                        'program_name': program_name,
                        'provider': program.get('provider', program.get('Provider', '')),
                        'location': program.get('location', program.get('City', '')),
                        'duration': program.get('duration', program.get('Duration', '')),
                        'cost': program.get('cost', program.get('Cost', '')),
                        'description': program.get('description', program.get('Description', '')),
                        'url': program.get('url', program.get('URL', '')),
                    }
                    unique_programs[program_name] = normalized_program
            
            programs_list = list(unique_programs.values())
            
            # STEP 3: Save API results to database for future use
            if programs_list:
                logger.info(f"Saving {len(programs_list)} programs to database")
                await save_programs_to_database(supabase, programs_list, user_state)
        
        # Filter and rank programs
        coal_specific, general_renewable = filter_and_rank_programs(programs_list, user_data)
        
        # Limit results
        max_results = request_body.max_results
        coal_specific = coal_specific[:max_results]
        general_renewable = general_renewable[:max_results]
        
        total_programs = len(coal_specific) + len(general_renewable)
        
        # Prepare response message
        data_source = "our curated database" if search_queries[0] == "database_cached" else "CareerOneStop"
        
        if coal_specific:
            message = f"Found {len(coal_specific)} coal miner-specific programs and {len(general_renewable)} general renewable energy programs in {state_name} from {data_source}."
        elif general_renewable:
            message = f"No coal miner-specific programs found, but found {len(general_renewable)} general renewable energy training programs in {state_name} from {data_source}."
        else:
            message = f"No training programs currently available in {state_name}. We recommend running the database setup to load curated programs."
        
        return TrainingRecommendationResponse(
            success=True,
            user_state=state_name,
            coal_miner_specific_programs=coal_specific,
            general_renewable_programs=general_renewable,
            total_programs=total_programs,
            search_details={
                'queries_used': search_queries,
                'state': state_name,
                'zip_code': zip_code,
                'total_raw_results': len(all_programs) if all_programs else len(programs_list),
                'unique_programs': len(programs_list),
                'data_source': data_source
            },
            message=message
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching coal miner training programs: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch training programs: {str(e)}"
        )


@router.post("/search-live-programs", response_model=TrainingRecommendationResponse)
async def search_live_training_programs(
    request_body: CoalMinerTrainingRequest,
    request: Request
):
    """
    Search for training programs in REAL-TIME using Google Search + AI extraction.
    
    This endpoint:
    1. Uses Tavily or Serper API to search the web
    2. Uses OpenAI to extract structured program data
    3. Does NOT use cache - always fresh results
    4. Saves results to database for future use
    
    Requires: TAVILY_API_KEY or SERPER_API_KEY + OPENAI_API_KEY
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
        
        logger.info(f"🔍 Starting LIVE search for training programs in {state_name}")
        
        # Check if OpenAI API key is available
        if not settings.openai_api_key:
            raise HTTPException(
                status_code=503,
                detail="OpenAI API key not configured. Cannot perform live search."
            )
        
        # Import and use the training search agent
        from app.services.agents.training_search_agent import TrainingSearchAgent
        
        agent = TrainingSearchAgent(openai_api_key=settings.openai_api_key)
        
        # Perform live search
        logger.info("Searching web for training programs...")
        search_results = await agent.search_programs(
            state=user_state, 
            max_programs=20,
            tavily_key=settings.tavily_api_key,
            serper_key=settings.serper_api_key
        )
        
        if not search_results['success']:
            raise HTTPException(
                status_code=503,
                detail=search_results.get('message', 'Search API not available. Please configure TAVILY_API_KEY or SERPER_API_KEY.')
            )
        
        programs_list = search_results.get('programs', [])
        search_method = search_results.get('search_method', 'unknown')
        
        logger.info(f"Found {len(programs_list)} programs using {search_method}")
        
        # Save to database for future use
        if programs_list:
            logger.info(f"Saving {len(programs_list)} programs to database...")
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
        message = f"✅ Live search complete! Found {len(coal_specific)} coal miner-specific and {len(general_renewable)} general renewable energy programs in {state_name} using {search_method} + AI extraction."
        
        if not programs_list:
            message = f"No programs found in live search. This might be due to API rate limits or no programs available in {state_name}."
        
        return TrainingRecommendationResponse(
            success=True,
            user_state=state_name,
            coal_miner_specific_programs=coal_specific,
            general_renewable_programs=general_renewable,
            total_programs=total_programs,
            search_details={
                'queries_used': ['google_search_live'],
                'state': state_name,
                'zip_code': 'N/A',
                'total_raw_results': search_results.get('total_raw_results', 0),
                'unique_programs': len(programs_list),
                'data_source': f'{search_method} + OpenAI extraction',
                'search_method': search_method
            },
            message=message
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in live search: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Live search failed: {str(e)}"
        )

