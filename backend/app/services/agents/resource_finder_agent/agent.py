from app.core.config import configure_adk_env, settings
configure_adk_env()
from google.adk.agents import LlmAgent, SequentialAgent
from google.adk.tools import google_search
import httpx
import logging


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

    Returns a dict with a list of playlists: [{playlistId, title, channelTitle, url}].
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
    return {"status": "success", "playlists": playlists}


def youtube_get_playlist_items(playlist_id: str, max_results: int) -> dict:
    """Fetch items from a YouTube playlist.

    Returns a dict with items: [{videoId, title, position, url}].
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
    return {"status": "success", "items": items}


# --- Sub-Agent 1: Online search for learning resources ---
search_agent = LlmAgent(
    name="SearchOnlineAgent",
    model="gemini-2.5-flash",
    instruction=(
        "You are a research assistant. Given the user's requested skill/topic, use Google Search to find "
        "5-10 popular, high-quality learning resources (courses, tutorials, documentation, playlists, channels). "
        "Prefer reputable sources and up-to-date content. Output ONLY JSON in the schema:\n"
        "{\n  \"resources\": [\n    {\"title\": str, \"source\": str, \"type\": str, \"url\": str}\n  ]\n}\n"
    ),
    description="Searches web for popular learning resources for a skill.",
    tools=[google_search],
    output_key="search_results",
)


# --- Sub-Agent 2: Use YouTube API to find playlists and videos ---
youtube_agent = LlmAgent(
    name="YouTubeFinderAgent",
    model="gemini-2.5-flash",
    instruction=(
        "You are a YouTube research assistant. The user skill/topic is in the conversation, and you also have \n"
        "the prior web resources below. Use the YouTube tools to: \n"
        "1) Find 1-3 high-quality playlists for this skill.\n"
        "2) For the best playlist, fetch up to 10 videos.\n"
        "Return ONLY JSON in the schema:\n"
        "{\n  \"playlist\": {\"playlistId\": str, \"title\": str, \"url\": str},\n  \"videos\": [\n    {\"videoId\": str, \"title\": str, \"url\": str}\n  ]\n}\n\n"
        "Call youtube_search_playlists with both parameters: (skill, max_results). Use 5 for max_results.\n"
        "Then call youtube_get_playlist_items with (playlist_id, max_results). Use 10 for max_results.\n"
        "Here are prior resources for context (do not echo them back):\n{search_results}"
    ),
    description="Finds relevant YouTube playlist and extracts videos.",
    tools=[youtube_search_playlists, youtube_get_playlist_items],
    output_key="youtube_selection",
)


# --- Sub-Agent 3: Refine and present curated output ---
refine_agent = LlmAgent(
    name="RefineCurationAgent",
    model="gemini-2.5-flash",
    instruction=(
        "Combine the web resources and YouTube selection into a concise curated plan for learning the skill.\n"
        "Output a short introduction (1-2 sentences), then a bullet list:\n"
        "- Top YouTube playlist (with link) and 5-10 key videos (linked)\n"
        "- 3-5 supplemental resources (linked) from the web search\n"
        "Keep it clean and skimmable.\n\n"
        "Context to use (do not echo verbatim):\n"
        "- Web search results: {search_results}\n"
        "- YouTube selection: {youtube_selection}"
    ),
    description="Refines results into a curated learning list.",
)


# --- Sequential pipeline ---
root_agent = SequentialAgent(
    name="ResourceFinderPipeline",
    sub_agents=[search_agent, youtube_agent, refine_agent],
    description="Searches web, finds YouTube playlists, and refines into a curated plan.",
)