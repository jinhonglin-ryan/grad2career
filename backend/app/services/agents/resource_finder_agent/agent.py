import json
import logging
import httpx
from app.core.config import configure_adk_env, settings

configure_adk_env()

from google.adk.agents import LlmAgent, SequentialAgent
from google.adk.agents.callback_context import CallbackContext
from google.genai import types
from google.adk.tools import google_search
from .schema import FinalPlan


logger = logging.getLogger("resource_finder")
if not logger.handlers:
    _handler = logging.StreamHandler()
    _formatter = logging.Formatter(
        fmt="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    _handler.setFormatter(_formatter)
    logger.addHandler(_handler)
logger.setLevel(logging.INFO)


def youtube_search_playlists(skill: str, max_results: int) -> dict:
    """Search YouTube for playlists related to a skill.

    Returns:
        dict: {status, playlists or error_message}
    """
    api_key = settings.youtube_api_key
    if not api_key:
        logger.warning("YouTube search skipped: missing YOUTUBE_API_KEY.")
        return {"status": "error", "error_message": "Missing YOUTUBE_API_KEY in environment."}

    url = "https://www.googleapis.com/youtube/v3/search"
    params = {
        "part": "snippet",
        "q": f"{skill} playlist",
        "type": "playlist",
        "maxResults": max_results,
        "key": api_key,
    }

    logger.info("YouTube playlist search: skill='%s', max_results=%s", skill, max_results)
    with httpx.Client(timeout=20.0) as client:
        resp = client.get(url, params=params)
        if resp.status_code != 200:
            logger.error("YouTube playlist search failed: %s", resp.text)
            return {"status": "error", "error_message": f"YouTube API error: {resp.text}"}
        data = resp.json()

    playlists = []
    for item in data.get("items", []):
        snippet = item.get("snippet", {})
        playlist_id = item.get("id", {}).get("playlistId")
        if not playlist_id:
            continue
        playlists.append({
            "playlistId": playlist_id,
            "title": snippet.get("title"),
            "channelTitle": snippet.get("channelTitle"),
            "url": f"https://www.youtube.com/playlist?list={playlist_id}",
        })

    logger.info("YouTube playlist search returned %d playlists", len(playlists))
    if not playlists:
        return {"status": "error", "error_message": "No playlists found."}

    return {"status": "success", "playlists": playlists}


def youtube_get_playlist_items(playlist_id: str, max_results: int) -> dict:
    """Fetch items from a YouTube playlist.

    Returns:
        dict: {status, items or error_message}
    """
    api_key = settings.youtube_api_key
    if not api_key:
        logger.warning("YouTube playlist items skipped: missing YOUTUBE_API_KEY.")
        return {"status": "error", "error_message": "Missing YOUTUBE_API_KEY in environment."}

    url = "https://www.googleapis.com/youtube/v3/playlistItems"
    params = {
        "part": "snippet,contentDetails",
        "playlistId": playlist_id,
        "maxResults": max_results,
        "key": api_key,
    }

    logger.info("YouTube playlist items: playlist_id='%s', max_results=%s", playlist_id, max_results)
    with httpx.Client(timeout=20.0) as client:
        resp = client.get(url, params=params)
        if resp.status_code != 200:
            logger.error("YouTube playlist items failed: %s", resp.text)
            return {"status": "error", "error_message": f"YouTube API error: {resp.text}"}
        data = resp.json()

    items = []
    for item in data.get("items", []):
        snippet = item.get("snippet", {})
        content = item.get("contentDetails", {})
        video_id = content.get("videoId")
        if not video_id:
            continue
        items.append({
            "videoId": video_id,
            "title": snippet.get("title"),
            "position": snippet.get("position"),
            "url": f"https://www.youtube.com/watch?v={video_id}",
        })

    logger.info("YouTube playlist items returned %d videos", len(items))
    if not items:
        return {"status": "error", "error_message": "No videos found in playlist."}

    return {"status": "success", "items": items}


search_agent = LlmAgent(
    name="SearchOnlineAgent",
    model="gemini-2.5-flash",
    instruction=(
        "You are a research assistant. Given the user's requested skill/topic, use Google Search to find "
        "5-10 popular, high-quality learning resources (courses, tutorials, documentation, playlists, channels) from resources such as Reddit, Youtube, and other reputable sources. "
        "Prefer reputable sources and up-to-date content. Output ONLY JSON in this schema:\n"
        "{ 'resources': [{'title': str, 'source': str, 'type': str, 'url': str}] }"
    ),
    description="Searches web for popular learning resources for a skill.",
    tools=[google_search],
    output_key="search_results",
)

youtube_agent = LlmAgent(
    name="YouTubeFinderAgent",
    model="gemini-2.5-flash",
    instruction=(
        "You are a YouTube research assistant. The user skill/topic is in the conversation, and you also have "
        "the prior web resources below. Use the YouTube tools to: \n"
        "1) Find 1-3 high-quality playlists for this skill.\n"
        "2) For the best playlist, fetch up to 10 videos.\n"
        "Return ONLY JSON in this schema:\n"
        "{ 'playlist': {'playlistId': str, 'title': str, 'url': str}, "
        "'videos': [{'videoId': str, 'title': str, 'url': str}] }.\n"
        "If nothing is found, respond with { 'status': 'error', 'error_message': 'No playlists found' }."
    ),
    description="Finds relevant YouTube playlists and extracts videos.",
    tools=[youtube_search_playlists, youtube_get_playlist_items],
    output_key="youtube_selection",
)

refine_agent = LlmAgent(
    name="RefineCurationAgent",
    model="gemini-2.5-flash",
    instruction=(
        "Combine the web search and YouTube selection into a clean, concise curated learning plan. "
        "Return ONLY JSON matching the output schema. "
        "Success example: { 'status': 'success', 'playlist': {...}, 'videos': [...], 'resources': [...] }. "
        "Failure example: { 'status': 'error', 'error_message': '...'}.\n\n"
        "Context (do not echo verbatim):\n"
        "- Web search results: {search_results}\n"
        "- YouTube selection: {youtube_selection}"
    ),
    description="Refines results into a final JSON learning plan.",
    output_schema=FinalPlan,
    output_key="final_plan",
)

root_agent = SequentialAgent(
    name="ResourceFinderPipeline",
    sub_agents=[search_agent, youtube_agent, refine_agent],
    description="Searches web, finds YouTube playlists, and refines into a curated plan.",
)
