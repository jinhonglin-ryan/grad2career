from typing import List, Optional, Literal
from pydantic import BaseModel


class ChecklistItem(BaseModel):
    requirement: str
    status: Literal["satisfied", "not_satisfied", "pending"]  # pending = insufficient info
    rationale: Optional[str] = None


class EligibilityResult(BaseModel):
    status: Literal["success", "error"]
    grant_name: str
    checklist: List[ChecklistItem]
    notes: Optional[str] = None
    error_message: Optional[str] = None


class DocumentItem(BaseModel):
    document_name: str
    description: str
    required: bool
    how_to_obtain: Optional[str] = None


class DocumentationResult(BaseModel):
    status: Literal["success", "error"]
    grant_name: str
    documents: List[DocumentItem]
    notes: Optional[str] = None
    error_message: Optional[str] = None


class FinalSubsidyResult(BaseModel):
    status: Literal["success", "error"]
    grant_name: str
    checklist: List[ChecklistItem]
    documents: List[DocumentItem]
    notes: Optional[str] = None
    error_message: Optional[str] = None
