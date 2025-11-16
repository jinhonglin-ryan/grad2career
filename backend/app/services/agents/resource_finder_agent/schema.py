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

class TrainingProgram(BaseModel):
    """Training program from CareerOneStop or local database."""
    program_name: Optional[str] = None
    provider_name: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    program_type: Optional[str] = None
    duration_weeks: Optional[int] = None
    duration_hours: Optional[int] = None
    cost: Optional[float] = None
    start_date: Optional[str] = None
    enrollment_deadline: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    website_url: Optional[str] = None

class FinalPlan(BaseModel):
    status: Literal["success", "error"]
    playlist: Optional[Playlist] = None
    videos: Optional[List[Video]] = None
    resources: Optional[List[ResourceItem]] = None
    training_programs: Optional[List[TrainingProgram]] = None
    error_message: Optional[str] = None