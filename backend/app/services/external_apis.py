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
    location: str,
    program_type: Optional[str] = None,
    distance: Optional[int] = None,
    max_results: int = 10
) -> Dict[str, Any]:
    """Search CareerOneStop for training programs, certifications, and licenses.
    
    Args:
        location: City and state (e.g., "New York, NY") or ZIP code
        program_type: Optional filter for program type
        distance: Optional maximum distance in miles
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

    # CareerOneStop API endpoint (adjust based on actual API documentation)
    # Note: The actual endpoint structure may vary - check API docs
    url = "https://api.careeronestop.org/v1/training"
    
    params = {
        "apikey": api_key,
        "location": location,
        "maxResults": max_results,
    }
    
    if program_type:
        params["programType"] = program_type
    if distance:
        params["distance"] = distance

    logger.info("CareerOneStop search: location='%s', max_results=%s", location, max_results)
    
    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.get(url, params=params)
            if resp.status_code != 200:
                logger.error("CareerOneStop API error: %s", resp.text)
                return {
                    "status": "error",
                    "error_message": f"CareerOneStop API error: {resp.status_code} - {resp.text}"
                }
            data = resp.json()
            
        programs = data.get("programs", [])
        logger.info("CareerOneStop search returned %d programs", len(programs))
        
        return {
            "status": "success",
            "programs": programs[:max_results]
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


