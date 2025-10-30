from typing import List, Optional, Literal
from pydantic import BaseModel

class Video(BaseModel):
    videoId: str
    title: str
    url: str

class ResourceItem(BaseModel):
    title: str
    source: str
    type: str
    url: str

class Playlist(BaseModel):
    playlistId: str
    title: str
    url: str

class FinalPlan(BaseModel):
    status: Literal["success", "error"]
    playlist: Optional[Playlist] = None
    videos: Optional[List[Video]] = None
    resources: Optional[List[ResourceItem]] = None
    error_message: Optional[str] = None