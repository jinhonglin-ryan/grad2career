"""
External API integrations for learning resources.

This module provides functions to interact with external APIs for finding
training programs, certifications, and learning opportunities.
"""

import logging
import httpx
from typing import Optional, Dict, List, Any
from app.core.config import settings

logger = logging.getLogger("external_apis")
if not logger.handlers:
    _handler = logging.StreamHandler()
    _formatter = logging.Formatter(
        fmt="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    _handler.setFormatter(_formatter)
    logger.addHandler(_handler)
logger.setLevel(logging.INFO)


def careeronestop_search_training(
    occupation: str,
    location: str,
    user_id: Optional[str] = None,
    max_results: int = 10
) -> Dict[str, Any]:
    """Search CareerOneStop for training programs, certifications, and licenses.
    
    Based on CareerOneStop Training Finder API:
    GET /v1/training/{userId}/{occupation}/{location}
    
    Args:
        occupation: Occupation code (O*NET-SOC code) or occupation name/keyword
        location: ZIP code (5-digit) or city, state format
        user_id: Optional user ID (if not provided, uses API key as userId)
        max_results: Maximum number of results to return
    
    Returns:
        dict: {
            "status": "success" | "error",
            "programs": [...] or "error_message": str
        }
    """
    api_key = settings.careeronestop_api_key
    if not api_key:
        logger.warning("CareerOneStop search skipped: missing CAREERONESTOP_API_KEY.")
        return {
            "status": "error",
            "error_message": "Missing CAREERONESTOP_API_KEY in environment. "
                           "Register at https://www.careeronestop.org/Developers/WebAPI/registration.aspx"
        }

    # Use provided user_id, or settings user_id, or API key as fallback
    # CareerOneStop API requires userId in URL path (may be separate from API token)
    userId = user_id or settings.careeronestop_user_id or api_key
    
    # CareerOneStop Training Finder API endpoint
    # Format: /v1/training/{userId}/{occupation}/{location}
    # Location can be ZIP code (5 digits) or "City, State"
    # Occupation can be O*NET-SOC code or keyword
    url = f"https://api.careeronestop.org/v1/training/{userId}/{occupation}/{location}"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json"
    }
    
    params = {}
    if max_results:
        params["limit"] = max_results

    logger.info("CareerOneStop search: occupation='%s', location='%s', max_results=%s", 
                occupation, location, max_results)
    
    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.get(url, headers=headers, params=params)
            if resp.status_code != 200:
                logger.error("CareerOneStop API error: status=%s, response=%s", resp.status_code, resp.text)
                return {
                    "status": "error",
                    "error_message": f"CareerOneStop API error: {resp.status_code} - {resp.text}"
                }
            data = resp.json()
            
        # CareerOneStop API returns training programs in various formats
        # Extract programs from the response structure
        programs = []
        if isinstance(data, dict):
            # Check common response structures
            programs = data.get("programs", data.get("Programs", data.get("results", [])))
        elif isinstance(data, list):
            programs = data
        
        logger.info("CareerOneStop search returned %d programs", len(programs))
        
        return {
            "status": "success",
            "programs": programs[:max_results] if programs else []
        }
    except Exception as e:
        logger.error("CareerOneStop search failed: %s", str(e))
        return {
            "status": "error",
            "error_message": f"CareerOneStop API request failed: {str(e)}"
        }


def credential_engine_search(
    query: str,
    credential_type: Optional[str] = None,
    location: Optional[str] = None,
    max_results: int = 10
) -> Dict[str, Any]:
    """Search Credential Engine Registry for credentials and learning opportunities.
    
    Args:
        query: Search query (skill, credential name, etc.)
        credential_type: Optional filter for credential type
        location: Optional location filter
        max_results: Maximum number of results to return
    
    Returns:
        dict: {
            "status": "success" | "error",
            "credentials": [...] or "error_message": str
        }
    """
    api_key = settings.credential_engine_api_key
    if not api_key:
        logger.warning("Credential Engine search skipped: missing CREDENTIAL_ENGINE_API_KEY.")
        return {
            "status": "error",
            "error_message": "Missing CREDENTIAL_ENGINE_API_KEY in environment. "
                           "Register at https://credreg.net/"
        }

    # Credential Engine API endpoint (adjust based on actual API documentation)
    # Note: The actual endpoint structure may vary - check API docs
    url = "https://api.credentialengine.org/v1/search"
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "query": query,
        "maxResults": max_results,
    }
    
    if credential_type:
        payload["credentialType"] = credential_type
    if location:
        payload["location"] = location

    logger.info("Credential Engine search: query='%s', max_results=%s", query, max_results)
    
    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.post(url, json=payload, headers=headers)
            if resp.status_code != 200:
                logger.error("Credential Engine API error: %s", resp.text)
                return {
                    "status": "error",
                    "error_message": f"Credential Engine API error: {resp.status_code} - {resp.text}"
                }
            data = resp.json()
            
        credentials = data.get("credentials", [])
        logger.info("Credential Engine search returned %d credentials", len(credentials))
        
        return {
            "status": "success",
            "credentials": credentials[:max_results]
        }
    except Exception as e:
        logger.error("Credential Engine search failed: %s", str(e))
        return {
            "status": "error",
            "error_message": f"Credential Engine API request failed: {str(e)}"
        }


def get_available_apis() -> Dict[str, Dict[str, Any]]:
    """Get information about available APIs and their configuration status.
    
    Returns:
        dict: API information with configuration status
    """
    return {
        "youtube": {
            "configured": bool(settings.youtube_api_key),
            "url": "https://developers.google.com/youtube/v3/docs/search/list",
            "description": "Training videos and playlists",
        },
        "careeronestop": {
            "configured": bool(settings.careeronestop_api_key),
            "url": "https://www.careeronestop.org/Developers/WebAPI/registration.aspx",
            "description": "State and local training programs, certifications, licenses, workforce boards",
        },
        "credential_engine": {
            "configured": bool(settings.credential_engine_api_key),
            "url": "https://credreg.net/",
            "description": "Credentials, learning opportunities, and providers with metadata",
        },
    }





