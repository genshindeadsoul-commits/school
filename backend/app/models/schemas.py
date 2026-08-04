"""Pydantic request/response models."""
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field


# ---------------------------------------------------------------- auth
class CoordinatorLogin(BaseModel):
    email: EmailStr
    password: str


class AdminLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str
    id: str


# ---------------------------------------------------------------- students
class StudentLookup(BaseModel):
    student_id: str = Field(..., description="Student ID or Admission Number")


class StudentPublic(BaseModel):
    id: str
    student_id: str
    name: str
    class_: str = Field(..., alias="class")
    section: str

    class Config:
        populate_by_name = True


class StudentCreate(BaseModel):
    student_id: str
    admission_no: Optional[str] = None
    name: str
    class_: str = Field(..., alias="class")
    section: str
    coordinator_id: Optional[str] = None

    class Config:
        populate_by_name = True


class StudentUpdate(BaseModel):
    student_id: Optional[str] = None
    admission_no: Optional[str] = None
    name: Optional[str] = None
    class_: Optional[str] = Field(None, alias="class")
    section: Optional[str] = None
    coordinator_id: Optional[str] = None

    class Config:
        populate_by_name = True


class StudentOut(BaseModel):
    id: str
    student_id: str
    admission_no: Optional[str] = None
    name: str
    class_: str = Field(..., alias="class")
    section: str
    coordinator_id: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


# ---------------------------------------------------------------- pickup requests
class PickupRequestCreate(BaseModel):
    student_id: str  # human student_id, not uuid


class PickupRequestOut(BaseModel):
    id: str
    student_id: str
    student_name: str
    student_code: str
    class_: str = Field(..., alias="class")
    section: str
    coordinator_id: Optional[str] = None
    request_time: datetime
    sent_time: Optional[datetime] = None
    status: str

    class Config:
        populate_by_name = True


# ---------------------------------------------------------------- coordinators
class CoordinatorCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    assigned_classes: List[str] = []


class CoordinatorUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    assigned_classes: Optional[List[str]] = None
    is_active: Optional[bool] = None


class CoordinatorOut(BaseModel):
    id: str
    name: str
    email: str
    assigned_classes: List[str]
    is_active: bool
    created_at: datetime


# ---------------------------------------------------------------- bulk ops
class BulkArchiveRequest(BaseModel):
    student_ids: Optional[List[str]] = None  # uuid list
    class_: Optional[str] = Field(None, alias="class")
    section: Optional[str] = None

    class Config:
        populate_by_name = True


class BulkDeleteRequest(BaseModel):
    student_ids: List[str]
    confirmation: str  # must equal "DELETE"


# ---------------------------------------------------------------- stats
class DashboardStats(BaseModel):
    todays_requests: int
    pending: int
    sent: int
    avg_response_seconds: Optional[float]
    peak_hour: Optional[int]
    requests_by_class: dict
    requests_by_coordinator: dict
