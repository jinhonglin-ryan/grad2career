"""
Training Program Search Agent using Google ADK with Multiple SubAgents
Uses a pipeline of specialized agents for robust, user-friendly training program search
"""
import json
import logging
import httpx
from typing import Dict, Any, List, Optional
from app.core.config import configure_adk_env, settings

configure_adk_env()

from google.adk.agents import LlmAgent, SequentialAgent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from .schema import TrainingSearchResult, ConstraintMatch, FinalPresentationResult, EnhancedProgramPresentation

logger = logging.getLogger("training_search_agent")
if not logger.handlers:
    _handler = logging.StreamHandler()
    _formatter = logging.Formatter(
        fmt="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    _handler.setFormatter(_formatter)
    logger.addHandler(_handler)
logger.setLevel(logging.INFO)


def serper_search(query: str, max_results: int) -> dict:
    """
    Search the web using Serper API (Google Search).
    
    Args:
        query: Search query string
        max_results: Maximum number of results to return (typically 5-10)
    
    Returns:
        dict: {status, results or error_message}
            results format: [{"title": str, "snippet": str, "link": str}, ...]
    """
    api_key = settings.serper_api_key
    if not api_key:
        logger.warning("Serper search skipped: missing SERPER_API_KEY")
        return {"status": "error", "error_message": "Missing SERPER_API_KEY in environment"}
    
    url = "https://google.serper.dev/search"
    headers = {
        "X-API-KEY": api_key,
        "Content-Type": "application/json"
    }
    payload = {
        "q": query,
        "num": max_results,
        "gl": "us",
    }
    
    logger.info(f"Serper search: query='{query}', max_results={max_results}")
    
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            
            results = []
            for item in data.get("organic", [])[:max_results]:
                results.append({
                    "title": item.get("title", ""),
                    "snippet": item.get("snippet", ""),
                    "link": item.get("link", "")
                })
            
            logger.info(f"Serper search returned {len(results)} results")
            return {"status": "success", "results": results}
            
    except Exception as e:
        logger.error(f"Serper search error: {str(e)}")
        return {"status": "error", "error_message": str(e)}


def verify_url(url: str) -> dict:
    """
    Verify if a URL is accessible (not 404 or error).
    
    Args:
        url: URL to check
    
    Returns:
        dict: {status: 'valid' or 'invalid', final_url: str (after redirects), error: str}
    """
    if not url or not url.startswith('http'):
        return {"status": "invalid", "error": "Invalid URL format"}
    
    try:
        with httpx.Client(timeout=10.0, follow_redirects=True) as client:
            response = client.head(url, timeout=10.0)
            
            # Check status code
            if response.status_code == 200:
                return {"status": "valid", "final_url": str(response.url)}
            elif response.status_code == 404:
                return {"status": "invalid", "error": "404 Not Found"}
            elif response.status_code >= 400:
                return {"status": "invalid", "error": f"HTTP {response.status_code}"}
            else:
                # Try GET if HEAD fails
                response = client.get(url, timeout=10.0)
                if response.status_code == 200:
                    return {"status": "valid", "final_url": str(response.url)}
                else:
                    return {"status": "invalid", "error": f"HTTP {response.status_code}"}
    except httpx.TimeoutException:
        return {"status": "invalid", "error": "Timeout"}
    except Exception as e:
        return {"status": "invalid", "error": str(e)}


def search_provider_location(provider_name: str, state: str) -> dict:
    """
    Search for a provider's location using Google Search, then geocode it.
    
    Args:
        provider_name: Name of the institution (e.g., "Blue Ridge Community College")
        state: State abbreviation or name (e.g., "WV" or "West Virginia")
    
    Returns:
        dict: {status, provider, full_address, city, state, latitude, longitude}
    """
    serper_key = settings.serper_api_key
    if not serper_key:
        return {"status": "error", "error": "SERPER_API_KEY not configured"}
    
    # Search for provider location
    search_query = f"{provider_name} {state} address location"
    
    try:
        with httpx.Client(timeout=10.0) as client:
            # Search with Serper
            response = client.post(
                "https://google.serper.dev/search",
                json={"q": search_query, "num": 3, "gl": "us"},
                headers={"X-API-KEY": serper_key, "Content-Type": "application/json"}
            )
            response.raise_for_status()
            data = response.json()
            
            # Try to extract location from knowledge graph or snippets
            location_found = None
            
            # Check knowledge graph
            if data.get("knowledgeGraph"):
                kg = data["knowledgeGraph"]
                if kg.get("address"):
                    location_found = kg["address"]
                elif kg.get("location"):
                    location_found = kg["location"]
            
            # Check organic results snippets
            if not location_found:
                for result in data.get("organic", [])[:3]:
                    snippet = result.get("snippet", "")
                    # Look for address patterns
                    if "address" in snippet.lower() or "located" in snippet.lower():
                        location_found = snippet
                        break
            
            # If we found location info, geocode it
            if location_found:
                geocode_query = f"{provider_name}, {location_found}"
                geo_result = geocode_address(geocode_query)
                if geo_result["status"] == "success":
                    return {
                        "status": "success",
                        "provider": provider_name,
                        "full_address": location_found,
                        "latitude": geo_result.get("latitude"),
                        "longitude": geo_result.get("longitude")
                    }
            
            # Fallback: just geocode provider name + state
            simple_query = f"{provider_name}, {state}"
            geo_result = geocode_address(simple_query)
            if geo_result["status"] == "success":
                return {
                    "status": "success",
                    "provider": provider_name,
                    "full_address": simple_query,
                    "latitude": geo_result.get("latitude"),
                    "longitude": geo_result.get("longitude")
                }
            
            return {"status": "error", "error": "Could not find location"}
            
    except Exception as e:
        logger.error(f"Error searching provider location: {str(e)}")
        return {"status": "error", "error": str(e)}


def geocode_address(address: str) -> dict:
    """
    Geocode an address to get latitude and longitude using Google Maps Geocoding API.
    
    Args:
        address: Full address string
    
    Returns:
        dict: {status, latitude, longitude or error_message}
    """
    api_key = getattr(settings, 'google_maps_api_key', None)
    if not api_key:
        logger.debug("Geocoding skipped: missing GOOGLE_MAPS_API_KEY")
        return {"status": "error", "error_message": "Missing GOOGLE_MAPS_API_KEY"}
    
    if not address:
        return {"status": "error", "error_message": "No address provided"}
    
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {
        "address": address,
        "key": api_key
    }
    
    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            if data.get("results"):
                location = data["results"][0]["geometry"]["location"]
                return {
                    "status": "success",
                    "latitude": location.get("lat"),
                    "longitude": location.get("lng")
                }
            else:
                return {"status": "error", "error_message": "No results found"}
                
    except Exception as e:
        logger.warning(f"Geocoding error for '{address}': {str(e)}")
        return {"status": "error", "error_message": str(e)}


# ============================================================================
# SUB-AGENT 1: Career-Specific Search Agent
# ============================================================================
career_search_agent = LlmAgent(
    name="CareerSearchAgent",
    model="gemini-2.0-flash-exp",
    instruction=(
        "Call serper_search 4 times with these queries (replace [career] and [state] with actual values from conversation):\n\n"
        
        "Query 1: serper_search(query='site:edu [career] certificate [state]', max_results=5)\n"
        "Query 2: serper_search(query='[career] training program [state] enroll', max_results=5)\n"
        "Query 3: serper_search(query='community college [career] [state]', max_results=5)\n"
        "Query 4: serper_search(query='[state] [career] certificate program', max_results=5)\n\n"
        
        "Then return JSON:\n"
        "{\n"
        "  'searches_performed': 4,\n"
        "  'queries_used': ['actual query 1', 'actual query 2', 'actual query 3', 'actual query 4'],\n"
        "  'total_results': (count total results from all 4 searches),\n"
        "  'summary': 'Searched for [career] programs in [state]'\n"
        "}"
    ),
    description="Searches for training programs using serper_search tool",
    tools=[serper_search],
    output_key="career_search_results",
)


# ============================================================================
# SUB-AGENT 2: Program Extraction Agent
# ============================================================================
extraction_agent = LlmAgent(
    name="ProgramExtractionAgent",
    model="gemini-2.0-flash-exp",
    tools=[verify_url],
    instruction=(
        "Extract programs. Verify URLs. MUST extract location for mapping.\n\n"
        
        "For each search result:\n"
        "1. Skip if URL has: blog, news, linkedin, facebook, medium\n"
        "2. If it's .edu or .org:\n"
        "   - Call verify_url(url='the_url')\n"
        "   - If status='valid': extract it\n"
        "   - If status='invalid': skip it\n"
        "3. CRITICAL - Extract location (for Google Maps):\n"
        "   - location: 'City, State' format (e.g., 'Martinsburg, WV')\n"
        "   - city: City name (e.g., 'Martinsburg')\n"
        "   - state: State code (WV, KY, PA)\n"
        "   - address: Full street address if in snippet\n"
        "   Look in snippet for: college location, address, city mentioned\n\n"
        
        "Example snippet: 'Blue Ridge Community College in Martinsburg, West Virginia offers...'\n"
        "Extract: location='Martinsburg, WV', city='Martinsburg', state='WV'\n\n"
        
        "Extract: program_name, provider, location, city, state, address, url, cost, duration, description\n\n"
        
        "Return JSON:\n"
        "{\n"
        "  'programs': [array with location fields],\n"
        "  'programs_found': int,\n"
        "  'programs_rejected': int,\n"
        "  'urls_verified': int,\n"
        "  'urls_404': int,\n"
        "  'extraction_summary': 'Found X programs (Y with location data)'\n"
        "}"
    ),
    description="Extracts programs, verifies URLs, extracts location for mapping",
    output_key="extracted_programs",
)


# ============================================================================
# SUB-AGENT 3: Fallback Search Agent (ALWAYS RUNS)
# ============================================================================
fallback_search_agent = LlmAgent(
    name="FallbackSearchAgent",
    model="gemini-2.0-flash-exp",
    instruction=(
        "Call serper_search 3 times with broader queries (replace [state] with actual state):\n\n"
        
        "Query 1: serper_search(query='site:edu renewable energy certificate [state]', max_results=5)\n"
        "Query 2: serper_search(query='skilled trades training [state]', max_results=5)\n"
        "Query 3: serper_search(query='workforce development [state] training', max_results=5)\n\n"
        
        "Return JSON:\n"
        "{\n"
        "  'fallback_needed': true,\n"
        "  'fallback_searches': 3,\n"
        "  'fallback_queries_used': ['actual query 1', 'actual query 2', 'actual query 3'],\n"
        "  'fallback_summary': 'Performed 3 broader searches'\n"
        "}"
    ),
    description="Always performs broader searches for additional programs",
    tools=[serper_search],
    output_key="fallback_results",
)


# ============================================================================
# SUB-AGENT 4: Final Extraction and Refinement Agent
# ============================================================================
refine_agent = LlmAgent(
    name="RefinementAgent",
    model="gemini-2.0-flash-exp",
    tools=[verify_url],
    instruction=(
        "Combine programs from extracted_programs and fallback_results.\n"
        "Extract programs from fallback search results, verify their URLs, then combine.\n\n"
        
        "Steps:\n"
        "1. Get programs from extracted_programs\n"
        "2. Extract programs from fallback_results search results, verify URLs with verify_url\n"
        "3. Combine, remove duplicates\n\n"
        
        "Return JSON (can use ```json markdown if needed):\n"
        "{\n"
        "  \"status\": \"success\",\n"
        "  \"career_title\": \"[career]\",\n"
        "  \"programs\": [array of program objects with: program_name, provider, location, url, cost, duration, description, is_coal_miner_specific, contact_info, schedule_type],\n"
        "  \"search_summary\": \"Found X programs\"\n"
        "}\n\n"
        
        "If no programs:\n"
        "{\n"
        "  \"status\": \"error\",\n"
        "  \"career_title\": \"[career]\",\n"
        "  \"programs\": [],\n"
        "  \"search_summary\": \"No programs found\",\n"
        "  \"error_message\": \"No results\"\n"
        "}"
    ),
    description="Combines and refines programs",
    output_key="final_training_programs",
)


# ============================================================================
# SUB-AGENT 5: Presentation Agent (User-Friendly Enhancement)
# ============================================================================
presentation_agent = LlmAgent(
    name="PresentationAgent",
    model="gemini-2.0-flash-exp",
    instruction=(
        "You are a career counselor presentation specialist.\n\n"
        
        "TASK: Take the programs from final_training_programs and enhance them for user presentation.\n"
        "User's constraints are in the conversation context.\n\n"
        
        "FOR EACH PROGRAM:\n"
        "1. Determine recommendation_level:\n"
        "   - 'highly_recommended': Perfect match (career-specific + meets all constraints + has clear enrollment)\n"
        "   - 'recommended': Good match (career-related + meets most constraints)\n"
        "   - 'alternative': Backup option (general program but could help)\n\n"
        
        "2. Write 'why_recommended' (1-2 sentences, personalized):\n"
        "   Examples:\n"
        "   - 'This program directly trains Solar Panel Installers and is FREE for coal miners through state grants'\n"
        "   - 'Located only 15 miles from you, offers evening classes perfect for your part-time schedule'\n"
        "   - 'Comprehensive renewable energy program that covers solar installation skills'\n\n"
        
        "3. Extract 'key_highlights' (3-5 bullet points):\n"
        "   - Focus on: cost benefits, schedule flexibility, coal miner specific, certifications earned, job placement\n"
        "   Examples:\n"
        "   - 'Free tuition for displaced coal miners'\n"
        "   - 'Flexible evening and weekend classes'\n"
        "   - 'Includes NABCEP certification'\n"
        "   - '90% job placement rate'\n"
        "   - 'Hands-on training with real equipment'\n\n"
        
        "4. Write 'next_steps' (specific actions):\n"
        "   Examples:\n"
        "   - 'Visit the enrollment page or call 304-555-0123 to schedule an appointment'\n"
        "   - 'Apply online at [url]. Next cohort starts January 2025'\n"
        "   - 'Contact admissions at admissions@college.edu for enrollment information'\n\n"
        
        "5. Add 'estimated_commitment' if you can infer from duration:\n"
        "   Examples: '10-15 hours/week for 12 weeks', 'Full-time (40 hours/week)', 'Self-paced online'\n\n"
        
        "CREATE OVERALL GUIDANCE:\n"
        "- executive_summary: 2-3 sentence overview of what was found\n"
        "- personalized_recommendation: Based on user's constraints, which programs are best and why\n\n"
        
        "IMPORTANT: Keep ALL original fields from programs (location, city, state, address, latitude, longitude, url, etc.)\n"
        "Add enhancement fields but DON'T remove original data.\n\n"
        
        "Return JSON:\n"
        "{\n"
        "  \"status\": \"success\",\n"
        "  \"career_title\": \"[career]\",\n"
        "  \"state\": \"[state]\",\n"
        "  \"total_programs_found\": X,\n"
        "  \"highly_recommended\": [enhanced programs with ALL original fields + new fields],\n"
        "  \"recommended\": [enhanced programs with ALL original fields + new fields],\n"
        "  \"alternatives\": [enhanced programs with ALL original fields + new fields],\n"
        "  \"executive_summary\": \"Found X training programs for [career] in [state]...\",\n"
        "  \"personalized_recommendation\": \"Based on your constraints, I recommend...\",\n"
        "  \"search_summary\": \"[brief]\"\n"
        "}\n\n"
        
        "Each program object must include:\n"
        "- All original fields: program_name, provider, location, city, state, address, latitude, longitude, url, cost, duration, description, is_coal_miner_specific, contact_info, schedule_type\n"
        "- New fields: recommendation_level, why_recommended, key_highlights, next_steps, estimated_commitment\n\n"
        
        "Be encouraging, specific, and actionable!"
    ),
    description="Enhances programs with personalized recommendations and detailed presentation",
    output_key="enhanced_presentation",
)


# ============================================================================
# SUB-AGENT 6: Location Mapping Agent
# ============================================================================
location_agent = LlmAgent(
    name="LocationMappingAgent",
    model="gemini-2.0-flash-exp",
    tools=[search_provider_location],
    instruction=(
        "You are a location mapping specialist.\n\n"
        
        "TASK: For EVERY program in enhanced_presentation, find its geographic location for Google Maps.\n\n"
        
        "PROCESS:\n"
        "For each program:\n"
        "1. Get the provider name (e.g., 'Blue Ridge Community College')\n"
        "2. Get the state (e.g., 'WV')\n"
        "3. Call search_provider_location(provider_name='provider name', state='state')\n"
        "4. If status='success', add latitude and longitude to the program\n"
        "5. If status='error', log it but continue with other programs\n\n"
        
        "IMPORTANT: Call search_provider_location for EVERY program.\n"
        "The tool will search Google for the provider's location and geocode it.\n\n"
        
        "Return JSON with ALL programs including their coordinates:\n"
        "{\n"
        "  \"status\": \"success\",\n"
        "  \"programs_with_location\": int,\n"
        "  \"total_programs\": int,\n"
        "  \"highly_recommended\": [programs with latitude/longitude added if found],\n"
        "  \"recommended\": [programs with latitude/longitude added if found],\n"
        "  \"alternatives\": [programs with latitude/longitude added if found],\n"
        "  \"location_summary\": \"Found locations for X out of Y programs\",\n"
        "  \"all_other_fields\": \"keep all fields from enhanced_presentation\"\n"
        "}\n\n"
        
        "Example:\n"
        "Input program: { 'provider': 'Blue Ridge CTC', 'state': 'WV', ... }\n"
        "Call: search_provider_location(provider_name='Blue Ridge CTC', state='WV')\n"
        "Result: { 'status': 'success', 'latitude': 39.456, 'longitude': -77.963 }\n"
        "Output: Add latitude: 39.456, longitude: -77.963 to the program object"
    ),
    description="Finds geographic coordinates for each training program provider",
    output_key="programs_with_locations",
)


# ============================================================================
# ROOT AGENT: Sequential Pipeline
# ============================================================================
training_search_pipeline = SequentialAgent(
    name="TrainingProgramSearchPipeline",
    sub_agents=[
        career_search_agent,      # Step 1: Search career-specific
        extraction_agent,          # Step 2: Extract programs
        fallback_search_agent,     # Step 3: Always perform broader search
        refine_agent,              # Step 4: Combine and refine
        presentation_agent,        # Step 5: Enhance for user presentation
        location_agent,            # Step 6: Find locations for Google Maps
    ],
    description=(
        "Multi-stage pipeline for finding training programs:\n"
        "1. Career-specific search\n"
        "2. Program extraction with URL verification\n"
        "3. Broader fallback search (always)\n"
        "4. Refinement and combination\n"
        "5. Enhanced user-friendly presentation\n"
        "6. Geographic location mapping"
    ),
)

# Create Runner for the pipeline
APP_NAME = "training_search_pipeline"
SESSION_SERVICE = InMemorySessionService()
RUNNER = Runner(
    agent=training_search_pipeline, 
    app_name=APP_NAME, 
    session_service=SESSION_SERVICE
)


def match_constraints(program: Dict[str, Any], user_constraints: Dict[str, Any]) -> ConstraintMatch:
    """
    Check if a program matches user's constraints using three-state logic.
    
    Three states: 'yes' (confirmed match), 'no' (confirmed mismatch), 'unknown' (info not available)
    
    Args:
        program: Program dictionary with cost, schedule_type, etc.
        user_constraints: Dict with budget_constraint, travel_constraint, scheduling
    
    Returns:
        ConstraintMatch object with matching results
    """
    meets_budget = 'unknown'
    meets_travel = 'unknown'
    meets_schedule = 'unknown'
    mismatch_reasons = []
    unknown_info = []
    
    # Budget matching
    budget_constraint = user_constraints.get('budget_constraint', '')
    program_cost = (program.get('cost') or '').strip()
    
    if budget_constraint and program_cost:
        program_cost_lower = program_cost.lower()
        
        if budget_constraint == 'free':
            if any(keyword in program_cost_lower for keyword in ['free', 'grant', 'funded', '$0', 'no cost']):
                meets_budget = 'yes'
            elif 'contact' in program_cost_lower or 'pricing' in program_cost_lower:
                meets_budget = 'unknown'
                unknown_info.append("Cost not specified - contact program for details")
            else:
                meets_budget = 'no'
                mismatch_reasons.append(f"Cost is {program_cost} (user needs free program)")
        elif budget_constraint == '1000':
            if any(keyword in program_cost_lower for keyword in ['free', 'grant', 'funded', '$0']):
                meets_budget = 'yes'
            elif '$' in program_cost_lower:
                try:
                    cost_str = program_cost_lower.split('$')[1].split()[0].replace(',', '').replace('+', '')
                    cost_num = int(''.join(filter(str.isdigit, cost_str)))
                    if cost_num <= 1000:
                        meets_budget = 'yes'
                    else:
                        meets_budget = 'no'
                        mismatch_reasons.append(f"Cost ${cost_num} exceeds budget of $1,000")
                except:
                    meets_budget = 'unknown'
                    unknown_info.append("Cost format unclear - please verify")
            else:
                meets_budget = 'unknown'
                unknown_info.append("Cost not specified - contact program")
    elif budget_constraint:
        meets_budget = 'unknown'
        unknown_info.append("No cost information available")
    
    # Travel/location matching
    travel_constraint = user_constraints.get('travel_constraint', '')
    schedule_type = (program.get('schedule_type') or '').strip().lower()
    
    if travel_constraint and schedule_type:
        if travel_constraint == 'remote':
            if 'online' in schedule_type or 'remote' in schedule_type:
                meets_travel = 'yes'
            elif 'in-person' in schedule_type or 'campus' in schedule_type or 'on-site' in schedule_type:
                meets_travel = 'no'
                mismatch_reasons.append("In-person program (user needs remote/online)")
            else:
                meets_travel = 'unknown'
                unknown_info.append("Delivery format not specified - verify if online option available")
        else:
            # User can travel - in-person is OK
            if 'online' in schedule_type or 'hybrid' in schedule_type or 'flexible' in schedule_type:
                meets_travel = 'yes'
            else:
                meets_travel = 'unknown'
                unknown_info.append("Location details not clear - verify program location")
    elif travel_constraint:
        meets_travel = 'unknown'
        unknown_info.append("No location/delivery format information")
    
    # Schedule matching
    scheduling = user_constraints.get('scheduling', '')
    
    if scheduling and schedule_type:
        if scheduling == 'evenings_weekends':
            if 'part' in schedule_type or 'evening' in schedule_type or 'weekend' in schedule_type or 'flexible' in schedule_type:
                meets_schedule = 'yes'
            elif 'full_time' in schedule_type or 'full-time' in schedule_type:
                meets_schedule = 'no'
                mismatch_reasons.append("Full-time schedule (user needs evenings/weekends)")
            else:
                meets_schedule = 'unknown'
                unknown_info.append("Schedule details not specified")
        elif scheduling == 'full_time':
            if 'full' in schedule_type:
                meets_schedule = 'yes'
            else:
                meets_schedule = 'unknown'
                unknown_info.append("Schedule format unclear")
        else:
            meets_schedule = 'yes'  # Flexible or no preference
    elif scheduling:
        meets_schedule = 'unknown'
        unknown_info.append("No schedule information available")
    
    # Overall match: True only if ALL are 'yes'
    overall_match = (meets_budget == 'yes' and meets_travel == 'yes' and meets_schedule == 'yes')
    
    return ConstraintMatch(
        meets_budget=meets_budget,
        meets_travel=meets_travel,
        meets_schedule=meets_schedule,
        overall_match=overall_match,
        mismatch_reasons=mismatch_reasons,
        unknown_info=unknown_info
    )


def add_geocoding_and_constraints(
    programs: List[Dict[str, Any]], 
    user_constraints: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """
    Post-process programs to add geocoding and constraint matching.
    
    Args:
        programs: List of program dictionaries from agent
        user_constraints: User constraint preferences
    
    Returns:
        Enhanced programs list with geocoding and constraint_match
    """
    enhanced_programs = []
    
    for program in programs:
        # Try geocoding using provider name (most reliable)
        provider = (program.get('provider') or '').strip()
        state = (program.get('state') or '').strip()
        location = (program.get('location') or '').strip()
        
        # Build search query for geocoding
        address_to_geocode = None
        
        # Priority 1: Provider name + State (most reliable for institutions)
        if provider:
            # Add state if available
            if state:
                address_to_geocode = f"{provider}, {state}"
            elif location:
                address_to_geocode = f"{provider}, {location}"
            else:
                address_to_geocode = provider
        # Priority 2: Just location if no provider
        elif location:
            address_to_geocode = location
        
        # Try geocoding
        if address_to_geocode:
            logger.info(f"🗺️  Geocoding: {program.get('program_name', 'Unknown')}")
            logger.info(f"   Query: {address_to_geocode}")
            geo_result = geocode_address(address_to_geocode)
            if geo_result['status'] == 'success':
                program['latitude'] = geo_result.get('latitude')
                program['longitude'] = geo_result.get('longitude')
                logger.info(f"   ✅ Success: ({program['latitude']}, {program['longitude']})")
            else:
                logger.warning(f"   ❌ Geocoding failed: {geo_result.get('error', 'Unknown error')}")
        else:
            logger.warning(f"   ⚠️  No provider/location info for: {program.get('program_name', 'Unknown')}")
        
        # Add constraint matching
        constraint_match = match_constraints(program, user_constraints)
        program['constraint_match'] = constraint_match.model_dump()
        
        # Calculate match score
        score = 50  # Base score
        
        # Career-specific bonus (detect if it's specific based on search context)
        if program.get('is_coal_miner_specific'):
            score += 30
        
        # Constraint match bonus
        if constraint_match.overall_match:
            score += 20
        elif constraint_match.meets_budget:
            score += 10
        
        program['match_score'] = min(score, 100)
        
        enhanced_programs.append(program)
    
    # Sort by match score
    enhanced_programs.sort(key=lambda x: x.get('match_score', 0), reverse=True)
    
    return enhanced_programs


async def search_training_programs(
    career_title: str,
    state: str,
    user_constraints: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Main function to search for training programs using the multi-agent pipeline.
    
    This uses a 4-stage pipeline:
    1. Career-specific search
    2. Program extraction
    3. Intelligent fallback (if needed)
    4. Refinement and user-friendly presentation
    
    Args:
        career_title: Career to search programs for
        state: User's state
        user_constraints: Optional dict with budget_constraint, travel_constraint, scheduling
    
    Returns:
        Dict with programs, constraint matching, and metadata
    """
    if user_constraints is None:
        user_constraints = {}
    
    # Map state codes to full names
    STATE_NAMES = {
            'west_virginia': 'West Virginia',
            'kentucky': 'Kentucky',
            'pennsylvania': 'Pennsylvania'
        }
    state_name = STATE_NAMES.get(state, state)
    
    logger.info(f"🔍 Starting multi-agent search for '{career_title}' in {state_name}")
    
    # Prepare context message for the pipeline
    initial_message = (
        f"Career Goal: {career_title}\n"
        f"Location: {state_name}\n"
        f"State Code: {state}\n\n"
        f"Please find training programs that will help users transition to this career. "
        f"Be thorough and user-friendly in your search and presentation."
    )
    
    try:
        # Create a unique session for this search
        import uuid
        session_id = f"training_search_{uuid.uuid4().hex[:8]}"
        user_id = "training_search_user"
        
        # Create session
        try:
            await SESSION_SERVICE.create_session(
                app_name=APP_NAME, 
                user_id=user_id, 
                session_id=session_id
            )
        except Exception as e:
            logger.warning(f"Session creation warning: {e}")
        
        # Run the sequential agent pipeline using Runner
        logger.info("🚀 Running 4-stage training search pipeline...")
        
        # Wrap message in types.Content
        content = types.Content(
            role="user", 
            parts=[types.Part(text=initial_message)]
        )
        
        final_text = None
        all_responses = []
        
        async for event in RUNNER.run_async(
            user_id=user_id, 
            session_id=session_id, 
            new_message=content
        ):
            # Collect responses
            if hasattr(event, "content") and event.content:
                parts = getattr(event.content, "parts", None) or []
                for part in parts:
                    if hasattr(part, "text") and part.text:
                        all_responses.append(part.text)
            
            # Get final response
            if hasattr(event, "is_final_response") and event.is_final_response():
                parts = getattr(getattr(event, "content", None), "parts", None) or []
                if parts and hasattr(parts[0], "text"):
                    final_text = parts[0].text
                    logger.info(f"✅ Pipeline completed")
        
        if not final_text:
            # Try to use the last response
            if all_responses:
                final_text = all_responses[-1]
            else:
                raise Exception("No response from pipeline")
        
        # Parse the final result
        try:
            result = json.loads(final_text)
        except json.JSONDecodeError:
            # Try to extract JSON from the text
            if "```json" in final_text:
                json_str = final_text.split("```json")[1].split("```")[0].strip()
                result = json.loads(json_str)
            elif "{" in final_text:
                # Find the first { and last }
                start = final_text.index("{")
                end = final_text.rindex("}") + 1
                result = json.loads(final_text[start:end])
            else:
                raise
        
        # Extract results from each stage and log details
        career_search = result.get('career_search_results', {})
        extracted = result.get('extracted_programs', {})
        fallback = result.get('fallback_results', {})
        refined_data = result.get('final_training_programs', {})
        presentation_data = result.get('enhanced_presentation', {})
        final_data = result.get('programs_with_locations', result)
        
        # Detailed logging of search quality
        logger.info(f"=" * 70)
        logger.info(f"✅ Stage 1 - Career Search:")
        logger.info(f"   Searches performed: {career_search.get('searches_performed', 0)}")
        if career_search.get('queries_used'):
            logger.info(f"   📝 Actual queries used:")
            for query in career_search.get('queries_used', []):
                logger.info(f"      → {query}")
        logger.info(f"   Total results: {career_search.get('total_results', 0)}")
        
        logger.info(f"\n✅ Stage 2 - Program Extraction & URL Verification:")
        logger.info(f"   Programs found (verified): {extracted.get('programs_found', 0)}")
        logger.info(f"   URLs verified: {extracted.get('urls_verified', 0)}")
        if extracted.get('urls_404', 0) > 0:
            logger.info(f"   ⚠️  URLs returned 404: {extracted.get('urls_404', 0)}")
        if extracted.get('programs_rejected', 0) > 0:
            logger.info(f"   ⚠️  Programs rejected: {extracted.get('programs_rejected', 0)}")
            if extracted.get('rejection_reasons'):
                reasons = extracted.get('rejection_reasons', [])
                logger.info(f"   Rejection reasons: {', '.join(reasons[:5])}")
        
        logger.info(f"\n✅ Stage 3 - Fallback Search (Always Runs):")
        logger.info(f"   🔄 Fallback searches: {fallback.get('fallback_searches', 0)}")
        if fallback.get('fallback_queries_used'):
            logger.info(f"   📝 Fallback queries:")
            for query in fallback.get('fallback_queries_used', []):
                logger.info(f"      → {query}")
        
        logger.info(f"\n✅ Stage 4 - Final Refinement:")
        logger.info(f"   Status: {refined_data.get('status', 'unknown')}")
        logger.info(f"   Programs refined: {len(refined_data.get('programs', []))}")
        
        logger.info(f"\n✅ Stage 5 - Enhanced Presentation:")
        logger.info(f"   Status: {presentation_data.get('status', 'unknown')}")
        if presentation_data.get('highly_recommended'):
            logger.info(f"   🌟 Highly Recommended: {len(presentation_data.get('highly_recommended', []))}")
        if presentation_data.get('recommended'):
            logger.info(f"   ⭐ Recommended: {len(presentation_data.get('recommended', []))}")
        if presentation_data.get('alternatives'):
            logger.info(f"   ✓ Alternatives: {len(presentation_data.get('alternatives', []))}")
        
        logger.info(f"\n✅ Stage 6 - Location Mapping:")
        logger.info(f"   Status: {final_data.get('status', 'unknown')}")
        logger.info(f"   Programs with locations: {final_data.get('programs_with_location', 0)}/{final_data.get('total_programs', 0)}")
        if final_data.get('location_summary'):
            logger.info(f"   {final_data.get('location_summary')}")
        logger.info(f"=" * 70)
        
        if final_data.get('status') != 'success':
            logger.warning(f"❌ Pipeline returned error: {final_data.get('error_message')}")
            return {
                'success': False,
                'career_title': career_title,
                'state': state_name,
                'career_specific_programs': [],
                'general_programs': [],
                'used_fallback': False,
                'total_programs': 0,
                'user_constraints': user_constraints,
                'message': final_data.get('search_summary', 'No programs found'),
                'executive_summary': final_data.get('executive_summary', ''),
                'personalized_recommendation': final_data.get('personalized_recommendation', '')
            }
        
        # Collect programs from all categories (now with locations from agent)
        highly_recommended = final_data.get('highly_recommended', [])
        recommended = final_data.get('recommended', [])
        alternatives = final_data.get('alternatives', [])
        all_programs = highly_recommended + recommended + alternatives
        
        # Convert Pydantic models to dicts if needed
        if all_programs and hasattr(all_programs[0], 'model_dump'):
            all_programs = [p.model_dump() for p in all_programs]
        elif all_programs and not isinstance(all_programs[0], dict):
            all_programs = [dict(p) if hasattr(p, '__dict__') else p for p in all_programs]
        
        # Count programs with location data
        programs_with_coords = sum(1 for p in all_programs if p.get('latitude') and p.get('longitude'))
        logger.info(f"🗺️  Final: {programs_with_coords}/{len(all_programs)} programs have map coordinates")
        
        # Separate career-specific and general programs based on match score
        # Higher scores = more career-specific  
        career_specific = [p for p in all_programs if p.get('match_score', 0) >= 70]
        general = [p for p in all_programs if p.get('match_score', 0) < 70]
        
        # Determine if fallback was used
        used_fallback = len(general) > 0 or len(all_programs) > 5
        
        logger.info(f"🎯 Results: {len(career_specific)} career-specific, {len(general)} general programs")
        
        return {
            'success': True,
            'career_title': career_title,
            'state': state_name,
            'career_specific_programs': career_specific,
            'general_programs': general,
            'used_fallback': used_fallback,
            'total_programs': len(all_programs),
            'user_constraints': user_constraints,
            'message': final_data.get('location_summary', f'Found {len(all_programs)} training programs'),
            # Enhanced presentation data with locations
            'highly_recommended': highly_recommended,
            'recommended': recommended,
            'alternatives': alternatives,
            'executive_summary': final_data.get('executive_summary', ''),
            'personalized_recommendation': final_data.get('personalized_recommendation', ''),
            'programs_with_location': programs_with_coords,
        }
        
    except Exception as e:
        logger.error(f"❌ Error in training search pipeline: {str(e)}", exc_info=True)
        return {
            'success': False,
            'career_title': career_title,
            'state': state_name,
            'career_specific_programs': [],
            'general_programs': [],
            'used_fallback': False,
            'total_programs': 0,
            'user_constraints': user_constraints,
            'message': f'Search error: {str(e)}'
        }

