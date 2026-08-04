"""Coordinator dashboard endpoints. Every query is scoped server-side to
the requesting coordinator's own id / assigned classes — a coordinator
can never see or act on another coordinator's students, even by guessing
IDs, because the WHERE clause is built from the JWT, not from client input.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.database import supabase
from app.core.security import require_coordinator
from app.utils.audit import log_action

router = APIRouter(prefix="/api/coordinator", tags=["coordinator"])


def _shape_request(row: dict) -> dict:
    student = row.get("students") or {}
    return {
        "id": row["id"],
        "student_id": student.get("id"),
        "student_name": student.get("name"),
        "student_code": student.get("student_id"),
        "class": student.get("class"),
        "section": student.get("section"),
        "coordinator_id": row.get("coordinator_id"),
        "request_time": row["request_time"],
        "sent_time": row.get("sent_time"),
        "status": row["status"],
    }


@router.get("/requests")
def list_requests(
    status_filter: Optional[str] = Query(None, alias="status"),
    class_filter: Optional[str] = Query(None, alias="class"),
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
    claims: dict = Depends(require_coordinator),
):
    coordinator_id = claims["sub"]

    query = (
        supabase.table("pickup_requests")
        .select("*, students!inner(id, name, student_id, class, section)")
        .eq("coordinator_id", coordinator_id)
        .order("request_time", desc=True)
    )

    if status_filter:
        query = query.eq("status", status_filter)
    if class_filter:
        query = query.eq("students.class", class_filter)
    if search:
        query = query.or_(
            f"student_id.ilike.%{search}%,name.ilike.%{search}%",
            reference_table="students",
        )

    start = (page - 1) * page_size
    end = start + page_size - 1
    res = query.range(start, end).execute()

    return {"items": [_shape_request(r) for r in res.data]}


@router.post("/requests/{request_id}/mark-sent")
def mark_sent(request_id: str, claims: dict = Depends(require_coordinator)):
    coordinator_id = claims["sub"]

    existing = (
        supabase.table("pickup_requests")
        .select("id, coordinator_id, status")
        .eq("id", request_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Request not found")

    row = existing.data[0]
    if row["coordinator_id"] != coordinator_id:
        raise HTTPException(status_code=403, detail="Not your assigned request")
    if row["status"] == "sent":
        return {"message": "Already marked as sent"}

    from datetime import datetime, timezone
    updated = (
        supabase.table("pickup_requests")
        .update({"status": "sent", "sent_time": datetime.now(timezone.utc).isoformat()})
        .eq("id", request_id)
        .execute()
    )

    log_action("coordinator", coordinator_id, "REQUEST_MARKED_SENT",
               entity_type="pickup_request", entity_id=request_id)

    return {"message": "Marked as sent", "request": updated.data[0]}


@router.get("/students")
def list_my_students(
    search: Optional[str] = None,
    class_filter: Optional[str] = Query(None, alias="class"),
    claims: dict = Depends(require_coordinator),
):
    coordinator_id = claims["sub"]
    query = (
        supabase.table("students")
        .select("id, student_id, name, class, section, status")
        .eq("coordinator_id", coordinator_id)
        .eq("status", "active")
    )
    if class_filter:
        query = query.eq("class", class_filter)
    if search:
        query = query.or_(f"name.ilike.%{search}%,student_id.ilike.%{search}%")

    res = query.execute()
    return {"items": res.data}
