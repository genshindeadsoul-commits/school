"""Parent-facing endpoints. No authentication — anyone with the gate QR
code can look up a student and submit a pickup request. Abuse is limited
by requiring an exact Student ID / Admission Number match and by the
one-pending-request-per-student DB constraint (a duplicate scan just
returns the existing pending request instead of erroring).
"""
from fastapi import APIRouter, HTTPException

from app.core.database import supabase
from app.models.schemas import StudentLookup, StudentPublic, PickupRequestCreate
from app.utils.audit import log_action

router = APIRouter(prefix="/api/parent", tags=["parent"])


@router.get("/search-students")
def search_students(query: str):
    """Lets a parent find their child by typing a name instead of needing
    the exact Student ID / Admission Number. Returns up to 10 active
    students whose name contains the query (case-insensitive)."""
    q = query.strip()
    if len(q) < 2:
        raise HTTPException(status_code=400, detail="Type at least 2 characters")

    res = (
        supabase.table("students")
        .select("id, student_id, name, class, section")
        .eq("status", "active")
        .ilike("name", f"%{q}%")
        .limit(10)
        .execute()
    )
    return {"items": res.data}


@router.post("/lookup-student", response_model=StudentPublic)
def lookup_student(payload: StudentLookup):
    sid = payload.student_id.strip()
    if not sid:
        raise HTTPException(status_code=400, detail="Student ID is required")

    res = (
        supabase.table("students")
        .select("id, student_id, admission_no, name, class, section, status")
        .or_(f"student_id.eq.{sid},admission_no.eq.{sid}")
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="No student found with that ID")

    student = res.data[0]
    if student["status"] != "active":
        raise HTTPException(
            status_code=404, detail="This student record is not currently active"
        )

    return StudentPublic(
        id=student["id"],
        student_id=student["student_id"],
        name=student["name"],
        **{"class": student["class"]},
        section=student["section"],
    )


@router.get("/request-status/{request_id}")
def request_status(request_id: str):
    """Minimal, unauthenticated status check for a single pickup request.
    Safe to expose publicly: request_id is an unguessable UUID and this
    returns only status/timestamps, never other students' data."""
    res = (
        supabase.table("pickup_requests")
        .select("id, status, request_time, sent_time, students(name)")
        .eq("id", request_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Request not found")

    row = res.data[0]
    student = row.get("students") or {}
    return {
        "id": row["id"],
        "status": row["status"],
        "request_time": row["request_time"],
        "sent_time": row.get("sent_time"),
        "student_name": student.get("name"),
    }


@router.post("/request-pickup", status_code=201)
def request_pickup(payload: PickupRequestCreate):
    sid = payload.student_id.strip()

    student_res = (
        supabase.table("students")
        .select("id, student_id, name, class, section, coordinator_id, status")
        .or_(f"student_id.eq.{sid},admission_no.eq.{sid}")
        .limit(1)
        .execute()
    )
    if not student_res.data:
        raise HTTPException(status_code=404, detail="Student not found")

    student = student_res.data[0]
    if student["status"] != "active":
        raise HTTPException(status_code=404, detail="Student is not active")

    # If there is already a pending request for this student, return it
    # instead of erroring (handles double-scans / double-clicks gracefully).
    existing = (
        supabase.table("pickup_requests")
        .select("*")
        .eq("student_id", student["id"])
        .eq("status", "pending")
        .limit(1)
        .execute()
    )
    if existing.data:
        return {
            "message": "A pickup request is already pending for this student",
            "request": existing.data[0],
        }

    result = (
        supabase.table("pickup_requests")
        .insert({
            "student_id": student["id"],
            "coordinator_id": student.get("coordinator_id"),
            "status": "pending",
        })
        .execute()
    )

    log_action(
        "parent", None, "PICKUP_REQUESTED",
        entity_type="pickup_request", entity_id=result.data[0]["id"],
        metadata={"student_id": student["student_id"], "student_name": student["name"]},
    )

    return {
        "message": f"Pickup request sent for {student['name']}. "
                    f"The coordinator has been notified.",
        "request": result.data[0],
    }
