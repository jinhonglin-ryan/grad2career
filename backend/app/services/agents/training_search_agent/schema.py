"""
Schema definitions for Training Search Agent
"""
from pydantic import BaseModel, Field
from typing import List, Optional


class TrainingProgram(BaseModel):
    """A single training program"""
    program_name: str = Field(description="Official program name")
    provider: str = Field(description="Organization offering the program")
    location: Optional[str] = Field(default=None, description="City, State")
    address: Optional[str] = Field(default=None, description="Full street address if available")
    city: Optional[str] = Field(default=None, description="City name")
    state: Optional[str] = Field(default=None, description="State abbreviation (WV, KY, PA)")
    duration: Optional[str] = Field(default=None, description="Program length (e.g., '12 weeks')")
    cost: Optional[str] = Field(default=None, description="Cost (e.g., 'Free', '$1,500', 'Contact for pricing')")
    description: Optional[str] = Field(default=None, description="Brief description of what you learn")
    url: Optional[str] = Field(default=None, description="Direct link to program page")
    is_coal_miner_specific: bool = Field(default=False, description="True if program is specifically for coal miners")
    contact_info: Optional[str] = Field(default=None, description="Phone or email contact")
    schedule_type: Optional[str] = Field(default=None, description="full_time, part_time, flexible, online, or hybrid")


class TrainingSearchResult(BaseModel):
    """Result from training program search"""
    status: str = Field(description="'success' or 'error'")
    career_title: str = Field(description="The career searched for")
    programs: List[TrainingProgram] = Field(default=[], description="List of found training programs")
    search_summary: str = Field(description="Summary of what was found")
    error_message: Optional[str] = Field(default=None, description="Error message if status is error")


class EnhancedProgramPresentation(BaseModel):
    """Enhanced program with detailed presentation"""
    program_name: str
    provider: str
    location: Optional[str] = None
    url: Optional[str] = None
    cost: Optional[str] = None
    duration: Optional[str] = None
    description: Optional[str] = None
    
    # Enhanced presentation fields
    recommendation_level: str = Field(description="'highly_recommended', 'recommended', or 'alternative'")
    why_recommended: str = Field(description="Personalized explanation why this is recommended")
    key_highlights: List[str] = Field(default=[], description="3-5 key selling points")
    next_steps: str = Field(description="Specific next steps for user to enroll")
    estimated_commitment: Optional[str] = Field(default=None, description="Weekly time commitment estimate")
    
    # Original fields
    is_coal_miner_specific: bool = False
    is_career_specific: bool = False
    match_score: float = 0.0
    contact_info: Optional[str] = None
    schedule_type: Optional[str] = None


class FinalPresentationResult(BaseModel):
    """Final enhanced result with detailed presentation"""
    status: str
    career_title: str
    state: str
    total_programs_found: int
    
    # Categorized programs with enhanced presentation
    highly_recommended: List[EnhancedProgramPresentation] = Field(default=[])
    recommended: List[EnhancedProgramPresentation] = Field(default=[])
    alternatives: List[EnhancedProgramPresentation] = Field(default=[])
    
    # User guidance
    executive_summary: str = Field(description="2-3 sentence overview for user")
    personalized_recommendation: str = Field(description="Personalized advice based on user's constraints")
    search_summary: str


class ConstraintMatch(BaseModel):
    """Constraint matching result with three states: matched, not_matched, unknown"""
    meets_budget: str = Field(description="'yes', 'no', or 'unknown' - budget match status")
    meets_travel: str = Field(description="'yes', 'no', or 'unknown' - travel match status")
    meets_schedule: str = Field(description="'yes', 'no', or 'unknown' - schedule match status")
    overall_match: bool = Field(description="True only if all constraints are 'yes'")
    mismatch_reasons: List[str] = Field(default=[], description="Reasons for constraint mismatches")
    unknown_info: List[str] = Field(default=[], description="Information not available (needs verification)")

