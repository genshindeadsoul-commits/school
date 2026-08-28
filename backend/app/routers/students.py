"""Admin-only student management: CRUD, archive/restore, bulk operations,
CSV/Excel import & export.
"""
import io
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse

from app.core.database import supabase
from app.core.security import require_admin
from app.models.schemas import (
    StudentCreate, StudentUpdate, BulkArchiveRequest, BulkDeleteRequest,
)
from app.utils.audit import log_action

router = APIRouter(prefix="/api/admin/students", tags=["admin-students"])

REQUIRED_IMPORT_COLUMNS = ["Student ID", "Student Name", "Class", "Section", "Coordinator"]


def _clean_coordinator_id(value: Optional[str]) -> Optional[str]:
    """Treats an empty string the same as None. The frontend's "No
    coordinator" dropdown option sends "" rather than omitting the field
    entirely, and "" is not a valid UUID — inserting/updating with it
    crashes the database call with a 500 error. This normalizes it."""
    if value is None or value.strip() == "":
        return None
    return value


# ---------------------------------------------------------------- CRUD
@router.get("")
def list_students(
    search: Optional[str] = None,
    class_filter: Optional[str] = Query(None, alias="class"),
    status_filter: Optional[str] = Query("active", alias="status"),
    page: int = 1,
    page_size: int = 50,
    claims: dict = Depends(require_admin),
):
    query = supabase.table("students").select("*", count="exact")
    if status_filter and status_filter != "all":
        query = query.eq("status", status_filter)
    if class_filter:
        query = query.eq("class", class_filter)
    if search:
        query = query.or_(f"name.ilike.%{search}%,student_id.ilike.%{search}%")

    start = (page - 1) * page_size
    end = start + page_size - 1
    res = query.order("created_at", desc=True).range(start, end).execute()
    return {"items": res.data, "total": res.count}


@router.post("", status_code=201)
def create_student(payload: StudentCreate, claims: dict = Depends(require_admin)):
    dup = (
        supabase.table("students")
        .select("id")
        .eq("student_id", payload.student_id)
        .execute()
    )
    if dup.data:
        raise HTTPException(status_code=409, detail="Student ID already exists")

    coordinator_id = _clean_coordinator_id(payload.coordinator_id)
    if coordinator_id:
        exists = (
            supabase.table("coordinators").select("id").eq("id", coordinator_id).execute()
        )
        if not exists.data:
            raise HTTPException(status_code=400, detail="Selected coordinator does not exist")

    row = {
        "student_id": payload.student_id,
        "admission_no": payload.admission_no,
        "name": payload.name,
        "class": payload.class_,
        "section": payload.section,
        "coordinator_id": coordinator_id,
    }
    try:
        result = supabase.table("students").insert(row).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not create student: {e}")

    log_action("admin", claims["sub"], "STUDENT_CREATED",
               entity_type="student", entity_id=result.data[0]["id"])
    return result.data[0]


@router.patch("/{student_uuid}")
def update_student(student_uuid: str, payload: StudentUpdate,
                    claims: dict = Depends(require_admin)):
    updates = {}
    if payload.student_id is not None:
        updates["student_id"] = payload.student_id
    if payload.admission_no is not None:
        updates["admission_no"] = payload.admission_no
    if payload.name is not None:
        updates["name"] = payload.name
    if payload.class_ is not None:
        updates["class"] = payload.class_
    if payload.section is not None:
        updates["section"] = payload.section
    if payload.coordinator_id is not None:
        updates["coordinator_id"] = _clean_coordinator_id(payload.coordinator_id)

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    try:
        result = supabase.table("students").update(updates).eq("id", student_uuid).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not update student: {e}")

    if not result.data:
        raise HTTPException(status_code=404, detail="Student not found")

    log_action("admin", claims["sub"], "STUDENT_UPDATED",
               entity_type="student", entity_id=student_uuid, metadata=updates)
    return result.data[0]


@router.post("/{student_uuid}/archive")
def archive_student(student_uuid: str, claims: dict = Depends(require_admin)):
    result = (
        supabase.table("students")
        .update({"status": "archived"})
        .eq("id", student_uuid)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Student not found")
    log_action("admin", claims["sub"], "STUDENT_ARCHIVED",
               entity_type="student", entity_id=student_uuid)
    return result.data[0]


@router.post("/{student_uuid}/restore")
def restore_student(student_uuid: str, claims: dict = Depends(require_admin)):
    result = (
        supabase.table("students")
        .update({"status": "active"})
        .eq("id", student_uuid)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Student not found")
    log_action("admin", claims["sub"], "STUDENT_RESTORED",
               entity_type="student", entity_id=student_uuid)
    return result.data[0]


# ---------------------------------------------------------------- bulk archive
@router.post("/bulk-archive")
def bulk_archive(payload: BulkArchiveRequest, claims: dict = Depends(require_admin)):
    query = supabase.table("students").update({"status": "archived"})

    if payload.student_ids:
        query = query.in_("id", payload.student_ids)
    elif payload.class_ and payload.section:
        query = query.eq("class", payload.class_).eq("section", payload.section)
    elif payload.class_:
        query = query.eq("class", payload.class_)
    else:
        raise HTTPException(
            status_code=400,
            detail="Provide student_ids, or class (optionally with section)",
        )

    result = query.execute()
    log_action("admin", claims["sub"], "BULK_ARCHIVE",
               metadata={"count": len(result.data)})
    return {"archived_count": len(result.data)}


# ---------------------------------------------------------------- bulk delete
@router.post("/bulk-delete")
def bulk_delete(payload: BulkDeleteRequest, claims: dict = Depends(require_admin)):
    if payload.confirmation != "DELETE":
        raise HTTPException(
            status_code=400,
            detail='You must type "DELETE" exactly to confirm this action',
        )
    if not payload.student_ids:
        raise HTTPException(status_code=400, detail="No student IDs provided")

    result = supabase.table("students").delete().in_("id", payload.student_ids).execute()
    log_action("admin", claims["sub"], "BULK_DELETE",
               metadata={"count": len(result.data), "ids": payload.student_ids})
    return {"deleted_count": len(result.data)}


@router.get("/bulk-delete/preview")
def bulk_delete_preview(ids: str, claims: dict = Depends(require_admin)):
    """ids = comma-separated uuid list. Returns the count for the
    confirmation dialog ('You are about to permanently delete XXX students')."""
    id_list = [i.strip() for i in ids.split(",") if i.strip()]
    if not id_list:
        return {"count": 0}
    res = supabase.table("students").select("id", count="exact").in_("id", id_list).execute()
    return {"count": res.count}


# ---------------------------------------------------------------- import
@router.get("/import/template.csv")
def download_csv_template():
    df = pd.DataFrame(columns=REQUIRED_IMPORT_COLUMNS)
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=student_import_template.csv"},
    )


@router.get("/import/template.xlsx")
def download_excel_template():
    df = pd.DataFrame(columns=REQUIRED_IMPORT_COLUMNS)
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Students")
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=student_import_template.xlsx"},
    )


def _read_upload_to_df(file: UploadFile) -> pd.DataFrame:
    content = file.file.read()
    if file.filename.lower().endswith(".csv"):
        return pd.read_csv(io.BytesIO(content))
    return pd.read_excel(io.BytesIO(content))


@router.post("/import/preview")
def preview_import(file: UploadFile = File(...), claims: dict = Depends(require_admin)):
    """Validates the uploaded file and returns a row-by-row preview with
    errors highlighted, without writing anything to the database."""
    try:
        df = _read_upload_to_df(file)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {e}")

    missing_cols = [c for c in REQUIRED_IMPORT_COLUMNS if c not in df.columns]
    if missing_cols:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required columns: {', '.join(missing_cols)}",
        )

    existing_ids = {
        r["student_id"] for r in supabase.table("students").select("student_id").execute().data
    }
    coordinator_emails = {
        r["email"] for r in supabase.table("coordinators").select("email").execute().data
    }

    seen_in_file = set()
    rows = []
    valid_count = 0

    for idx, r in df.iterrows():
        errors = []
        sid = str(r.get("Student ID", "")).strip()
        name = str(r.get("Student Name", "")).strip()
        klass = str(r.get("Class", "")).strip()
        section = str(r.get("Section", "")).strip()
        coordinator = str(r.get("Coordinator", "")).strip()

        if not sid or sid.lower() == "nan":
            errors.append("Missing Student ID")
        elif sid in existing_ids:
            errors.append("Duplicate: Student ID already exists in database")
        elif sid in seen_in_file:
            errors.append("Duplicate: Student ID repeated in this file")
        else:
            seen_in_file.add(sid)

        if not name or name.lower() == "nan":
            errors.append("Missing Student Name")
        if not klass or klass.lower() == "nan":
            errors.append("Missing Class")
        if not section or section.lower() == "nan":
            errors.append("Missing Section")
        if not coordinator or coordinator.lower() == "nan":
            errors.append("Missing Coordinator")
        elif coordinator not in coordinator_emails:
            errors.append(f"Unknown coordinator email: {coordinator}")

        is_valid = len(errors) == 0
        if is_valid:
            valid_count += 1

        rows.append({
            "row_number": int(idx) + 2,
            "student_id": sid, "name": name, "class": klass,
            "section": section, "coordinator": coordinator,
            "valid": is_valid, "errors": errors,
        })

    return {
        "rows": rows,
        "total": len(rows),
        "valid_count": valid_count,
        "invalid_count": len(rows) - valid_count,
    }


@router.post("/import/commit")
def commit_import(file: UploadFile = File(...), claims: dict = Depends(require_admin)):
    """Re-validates and imports only the valid rows. Returns success/failure counts."""
    try:
        df = _read_upload_to_df(file)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {e}")

    missing_cols = [c for c in REQUIRED_IMPORT_COLUMNS if c not in df.columns]
    if missing_cols:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required columns: {', '.join(missing_cols)}",
        )

    existing_ids = {
        r["student_id"] for r in supabase.table("students").select("student_id").execute().data
    }
    coordinators_by_email = {
        r["email"]: r["id"]
        for r in supabase.table("coordinators").select("id, email").execute().data
    }

    to_insert = []
    seen_in_file = set()
    failures = []

    for idx, r in df.iterrows():
        sid = str(r.get("Student ID", "")).strip()
        name = str(r.get("Student Name", "")).strip()
        klass = str(r.get("Class", "")).strip()
        section = str(r.get("Section", "")).strip()
        coordinator_email = str(r.get("Coordinator", "")).strip()

        row_valid = (
            sid and sid.lower() != "nan"
            and sid not in existing_ids and sid not in seen_in_file
            and name and name.lower() != "nan"
            and klass and klass.lower() != "nan"
            and section and section.lower() != "nan"
            and coordinator_email in coordinators_by_email
        )
        if row_valid:
            seen_in_file.add(sid)
            to_insert.append({
                "student_id": sid,
                "name": name,
                "class": klass,
                "section": section,
                "coordinator_id": coordinators_by_email[coordinator_email],
            })
        else:
            failures.append(int(idx) + 2)

    inserted = []
    if to_insert:
        result = supabase.table("students").insert(to_insert).execute()
        inserted = result.data

    log_action("admin", claims["sub"], "BULK_IMPORT",
               metadata={"success": len(inserted), "failed": len(failures)})

    return {
        "success_count": len(inserted),
        "failure_count": len(failures),
        "failed_rows": failures,
    }


# ---------------------------------------------------------------- export
@router.get("/export")
def export_students(
    status_filter: Optional[str] = Query("active", alias="status"),
    claims: dict = Depends(require_admin),
):
    query = supabase.table("students").select("*")
    if status_filter and status_filter != "all":
        query = query.eq("status", status_filter)
    res = query.execute()

    df = pd.DataFrame(res.data)
    if not df.empty:
        df = df[["student_id", "admission_no", "name", "class", "section",
                  "coordinator_id", "status", "created_at"]]
        df.columns = ["Student ID", "Admission No", "Name", "Class", "Section",
                       "Coordinator ID", "Status", "Created At"]

    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Students")
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=students_export.xlsx"},
    )
