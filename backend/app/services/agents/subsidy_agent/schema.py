from typing import List, Optional, Literal
from pydantic import BaseModel


class SourceItem(BaseModel):
    title: Optional[str] = None
    url: str
    snippet: Optional[str] = None


class ChecklistItem(BaseModel):
    requirement: str
    satisfied: bool
    rationale: Optional[str] = None


class FinalSubsidyResult(BaseModel):
    status: Literal["success", "error"]
    grant_name: str
    checklist: List[ChecklistItem]
    sources: List[SourceItem]
    notes: Optional[str] = None
    error_message: Optional[str] = None


