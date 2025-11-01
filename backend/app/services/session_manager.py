"""
Session Management Service for Conversational Assessment

Manages conversation state and turn tracking for the 4-turn dialogue.
"""
import logging
from typing import Dict, List, Optional
from datetime import datetime
from uuid import uuid4

logger = logging.getLogger(__name__)


class AssessmentSession:
    """Represents a single assessment session."""
    
    def __init__(self, user_id: str, session_id: Optional[str] = None):
        self.user_id = user_id
        self.session_id = session_id or str(uuid4())
        self.messages: List[Dict[str, str]] = []
        self.current_turn = 1
        self.is_complete = False
        self.skill_profile: Optional[Dict] = None
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
    
    def add_message(self, role: str, content: str):
        """Add a message to the conversation history."""
        self.messages.append({
            "role": role,
            "content": content
        })
        self.updated_at = datetime.utcnow()
    
    def advance_turn(self):
        """Advance to the next turn."""
        if self.current_turn < 4:
            self.current_turn += 1
            self.updated_at = datetime.utcnow()
        else:
            self.is_complete = True
    
    def complete(self, skill_profile: Optional[Dict] = None):
        """Mark the session as complete."""
        self.is_complete = True
        self.current_turn = 4
        if skill_profile:
            self.skill_profile = skill_profile
        self.updated_at = datetime.utcnow()
    
    def to_dict(self) -> Dict:
        """Convert session to dictionary."""
        return {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "current_turn": self.current_turn,
            "is_complete": self.is_complete,
            "message_count": len(self.messages),
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }


class SessionManager:
    """Manages assessment sessions in memory (can be extended to use database)."""
    
    def __init__(self):
        self.sessions: Dict[str, AssessmentSession] = {}
    
    def get_session(
        self,
        user_id: str,
        session_id: Optional[str] = None
    ) -> AssessmentSession:
        """
        Get or create a session.
        
        Args:
            user_id: User identifier
            session_id: Optional session ID. If None, creates a new session.
            
        Returns:
            AssessmentSession
        """
        if session_id and session_id in self.sessions:
            session = self.sessions[session_id]
            if session.user_id != user_id:
                raise ValueError("Session belongs to a different user")
            return session
        
        # Create new session
        session = AssessmentSession(user_id, session_id)
        self.sessions[session.session_id] = session
        logger.info(f"Created new assessment session: {session.session_id} for user: {user_id}")
        return session
    
    def delete_session(self, session_id: str):
        """Delete a session."""
        if session_id in self.sessions:
            del self.sessions[session_id]
            logger.info(f"Deleted session: {session_id}")
    
    def get_user_sessions(self, user_id: str) -> List[Dict]:
        """Get all sessions for a user."""
        return [
            session.to_dict()
            for session in self.sessions.values()
            if session.user_id == user_id
        ]


# Global session manager instance
session_manager = SessionManager()

