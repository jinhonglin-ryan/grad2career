from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any

try:
    # youtube-transcript-api >=1.2.3
    from youtube_transcript_api import YouTubeTranscriptApi
except Exception:  # pragma: no cover
    YouTubeTranscriptApi = None  # type: ignore


router = APIRouter()


@router.get("/transcript/{video_id}")
def get_transcript(video_id: str, languages: str = "en,en-US,en-GB") -> Dict[str, Any]:
    """
    Return the transcript for a YouTube video.
    - video_id: YouTube video id (not full URL)
    - languages: comma-separated language codes in priority order
    """
    if YouTubeTranscriptApi is None:
        raise HTTPException(status_code=500, detail="youtube-transcript-api not installed on server")

    langs: List[str] = [code.strip() for code in languages.split(",") if code.strip()]
    if not langs:
        langs = ["en"]

    try:
        api = YouTubeTranscriptApi()
        fetched = api.fetch(video_id, languages=langs)
        # convert to raw list of dicts
        data = [
            {
                "text": s.text,
                "start": getattr(s, "start", None),
                "duration": getattr(s, "duration", None),
            }
            for s in fetched
        ]
        return {"status": "success", "video_id": video_id, "language": getattr(fetched, "language_code", None), "transcript": data}
    except Exception as e:  # The lib raises specific exceptions; bubble as 404/400 generically
        raise HTTPException(status_code=404, detail=f"Transcript unavailable: {str(e)}")


