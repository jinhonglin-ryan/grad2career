"""
API Routes for Learning Path Management
"""
import logging
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.core.supabase import get_supabase
from supabase import Client
import uuid

router = APIRouter()
logger = logging.getLogger(__name__)


# Import get_current_user from auth routes
async def get_current_user(request: Request):
    """Get current user from JWT token"""
    from app.api.routes.auth import verify_jwt_token
    
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Authentication required")
    
    token = auth_header.replace('Bearer ', '')
    payload = verify_jwt_token(token)
    
    return payload['user_id']


class VideoItem(BaseModel):
    """Video item model."""
    video_id: str = Field(..., alias="videoId")
    title: str
    url: str
    thumbnail: Optional[str] = None
    duration: Optional[str] = None
    
    class Config:
        populate_by_name = True


class ScheduledVideo(BaseModel):
    """Scheduled video model."""
    date: str  # ISO date string (yyyy-mm-dd)
    video: VideoItem
    completed: bool = False
    completed_at: Optional[str] = None
    notes: Optional[str] = None


class LearningPath(BaseModel):
    """Learning path model."""
    id: Optional[str] = None
    user_id: str
    career_id: Optional[str] = None
    career_title: str
    scheduled_videos: List[ScheduledVideo]
    status: str = "active"  # 'active', 'completed', 'paused'
    progress_percentage: float = 0.0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class CreateLearningPathRequest(BaseModel):
    """Request to create a learning path."""
    career_title: str
    career_id: Optional[str] = None
    scheduled_videos: List[ScheduledVideo]


class UpdateProgressRequest(BaseModel):
    """Request to update video progress."""
    video_id: str = Field(..., alias="videoId")
    date: str
    completed: bool
    notes: Optional[str] = None
    
    class Config:
        populate_by_name = True


@router.post("/learning-paths", response_model=Dict[str, Any])
async def create_learning_path(
    create_request: CreateLearningPathRequest,
    request: Request
) -> Dict[str, Any]:
    """Create a new learning path."""
    user_id = await get_current_user(request)
    logger.info(f"Creating learning path for user: {user_id}")
    logger.info(f"Career ID: {create_request.career_id}, Career Title: {create_request.career_title}")
    supabase = get_supabase()
    
    try:
        # Prepare path data
        path_data = {
            "career_title": create_request.career_title,
            "scheduled_videos": [
                {
                    "date": sv.date,
                    "video": sv.video.model_dump(by_alias=True),
                    "completed": sv.completed,
                    "completed_at": sv.completed_at,
                    "notes": sv.notes
                }
                for sv in create_request.scheduled_videos
            ]
        }
        
        # Calculate initial progress
        total_videos = len(create_request.scheduled_videos)
        completed_videos = sum(1 for sv in create_request.scheduled_videos if sv.completed)
        progress = (completed_videos / total_videos * 100) if total_videos > 0 else 0
        
        # Insert into database
        learning_path_data = {
            "user_id": user_id,
            "path_data": path_data,
            "status": "active",
            "progress_percentage": progress
        }
        
        # Only add career_id if it's a valid UUID and exists in career_matches table
        if create_request.career_id:
            try:
                # Validate UUID format
                uuid.UUID(create_request.career_id)
                
                # Check if career_id exists in career_matches table
                career_check = supabase.table("career_matches")\
                    .select("id")\
                    .eq("id", create_request.career_id)\
                    .execute()
                
                if career_check.data and len(career_check.data) > 0:
                    learning_path_data["career_id"] = create_request.career_id
                    logger.info(f"Valid career_id found in career_matches: {create_request.career_id}")
                else:
                    logger.warning(f"career_id '{create_request.career_id}' not found in career_matches table, skipping")
            except (ValueError, AttributeError) as e:
                # Invalid UUID, skip it
                logger.warning(f"Invalid UUID for career_id '{create_request.career_id}': {e}")
        
        logger.info(f"Inserting learning path data: user_id={user_id}, status=active, progress={progress}")
        logger.info(f"Path data contains {len(path_data.get('scheduled_videos', []))} videos")
        
        result = supabase.table("learning_paths").insert(learning_path_data).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create learning path")
        
        return {
            "success": True,
            "data": result.data[0]
        }
        
    except Exception as e:
        logger.error(f"Error creating learning path: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/learning-paths/current", response_model=Dict[str, Any])
async def get_current_learning_path(
    request: Request
) -> Dict[str, Any]:
    """Get the user's current active learning path."""
    user_id = await get_current_user(request)
    supabase = get_supabase()
    
    try:
        # Get most recent active learning path
        result = supabase.table("learning_paths")\
            .select("*")\
            .eq("user_id", user_id)\
            .eq("status", "active")\
            .order("created_at", desc=True)\
            .limit(1)\
            .execute()
        
        if not result.data or len(result.data) == 0:
            return {
                "success": True,
                "data": None
            }
        
        return {
            "success": True,
            "data": result.data[0]
        }
        
    except Exception as e:
        logger.error(f"Error fetching learning path: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/learning-paths", response_model=Dict[str, Any])
async def get_all_learning_paths(
    request: Request
) -> Dict[str, Any]:
    """Get all learning paths for a user."""
    user_id = await get_current_user(request)
    supabase = get_supabase()
    
    try:
        result = supabase.table("learning_paths")\
            .select("*")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .execute()
        
        return {
            "success": True,
            "data": result.data or []
        }
        
    except Exception as e:
        logger.error(f"Error fetching learning paths: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/learning-paths/{path_id}/progress", response_model=Dict[str, Any])
async def update_video_progress(
    path_id: str,
    update_request: UpdateProgressRequest,
    request: Request
) -> Dict[str, Any]:
    """Update progress for a specific video."""
    user_id = await get_current_user(request)
    supabase = get_supabase()
    
    try:
        # Get current learning path
        result = supabase.table("learning_paths")\
            .select("*")\
            .eq("id", path_id)\
            .eq("user_id", user_id)\
            .execute()
        
        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=404, detail="Learning path not found")
        
        learning_path = result.data[0]
        path_data = learning_path["path_data"]
        
        # Update the specific video
        updated = False
        for video in path_data.get("scheduled_videos", []):
            if (video["video"]["videoId"] == update_request.video_id and 
                video["date"] == update_request.date):
                video["completed"] = update_request.completed
                video["completed_at"] = datetime.utcnow().isoformat() if update_request.completed else None
                if update_request.notes is not None:
                    video["notes"] = update_request.notes
                updated = True
                break
        
        if not updated:
            raise HTTPException(status_code=404, detail="Video not found in learning path")
        
        # Recalculate progress
        scheduled_videos = path_data.get("scheduled_videos", [])
        total_videos = len(scheduled_videos)
        completed_videos = sum(1 for sv in scheduled_videos if sv.get("completed", False))
        progress = (completed_videos / total_videos * 100) if total_videos > 0 else 0
        
        # Update in database
        update_result = supabase.table("learning_paths")\
            .update({
                "path_data": path_data,
                "progress_percentage": progress,
                "updated_at": datetime.utcnow().isoformat()
            })\
            .eq("id", path_id)\
            .execute()
        
        # Also save to learning_progress table for detailed tracking
        progress_data = {
            "user_id": user_id,
            "learning_path_id": path_id,
            "week_number": 1,  # TODO: Calculate actual week number
            "resource_id": update_request.video_id,
            "completed": update_request.completed,
            "completed_at": datetime.utcnow().isoformat() if update_request.completed else None,
            "notes": update_request.notes,
            "created_at": datetime.utcnow().isoformat()
        }
        
        supabase.table("learning_progress").insert(progress_data).execute()
        
        return {
            "success": True,
            "data": update_result.data[0] if update_result.data else None,
            "progress": progress
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating progress: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/learning-paths/{path_id}/status", response_model=Dict[str, Any])
async def update_learning_path_status(
    path_id: str,
    status: str,
    request: Request
) -> Dict[str, Any]:
    """Update the status of a learning path."""
    user_id = await get_current_user(request)
    supabase = get_supabase()
    
    if status not in ["active", "completed", "paused"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    try:
        result = supabase.table("learning_paths")\
            .update({
                "status": status,
                "updated_at": datetime.utcnow().isoformat()
            })\
            .eq("id", path_id)\
            .eq("user_id", user_id)\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Learning path not found")
        
        return {
            "success": True,
            "data": result.data[0]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/learning-paths/{path_id}", response_model=Dict[str, Any])
async def delete_learning_path(
    path_id: str,
    request: Request
) -> Dict[str, Any]:
    """Delete a learning path."""
    user_id = await get_current_user(request)
    supabase = get_supabase()
    
    try:
        result = supabase.table("learning_paths")\
            .delete()\
            .eq("id", path_id)\
            .eq("user_id", user_id)\
            .execute()
        
        return {
            "success": True,
            "message": "Learning path deleted successfully"
        }
        
    except Exception as e:
        logger.error(f"Error deleting learning path: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

