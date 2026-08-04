"""Admin management of coordinator accounts."""
from fastapi import APIRouter, Depends, HTTPException

from app.core.database import supabase
from app.core.security import require_admin, hash_password
from app.models.schemas import CoordinatorCreate, CoordinatorUpdate
from app.utils.audit import log_action

router = APIRouter(prefix="/api/admin/coordinators", tags=["admin-coordinators"])


@router.get("")
def list_coordinators(claims: dict = Depends(require_admin)):
    res = (
        supabase.table("coordinators")
        .select("id, name, email, assigned_classes, is_active, created_at")
        .order("created_at", desc=True)
        .execute()
    )
    return {"items": res.data}


@router.post("", status_code=201)
def create_coordinator(payload: CoordinatorCreate, claims: dict = Depends(require_admin)):
    dup = supabase.table("coordinators").select("id").eq("email", payload.email).execute()
    if dup.data:
        raise HTTPException(status_code=409, detail="Email already registered")

    result = supabase.table("coordinators").insert({
        "name": payload.name,
        "email": payload.email,
        "password_hash": hash_password(payload.password),
        "assigned_classes": payload.assigned_classes,
    }).execute()

    log_action("admin", claims["sub"], "COORDINATOR_CREATED",
               entity_type="coordinator", entity_id=result.data[0]["id"])
    row = result.data[0]
    row.pop("password_hash", None)
    return row


@router.patch("/{coordinator_id}")
def update_coordinator(coordinator_id: str, payload: CoordinatorUpdate,
                        claims: dict = Depends(require_admin)):
    updates = {}
    if payload.name is not None:
        updates["name"] = payload.name
    if payload.email is not None:
        updates["email"] = payload.email
    if payload.password is not None:
        updates["password_hash"] = hash_password(payload.password)
    if payload.assigned_classes is not None:
        updates["assigned_classes"] = payload.assigned_classes
    if payload.is_active is not None:
        updates["is_active"] = payload.is_active

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = (
        supabase.table("coordinators").update(updates).eq("id", coordinator_id).execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Coordinator not found")

    log_action("admin", claims["sub"], "COORDINATOR_UPDATED",
               entity_type="coordinator", entity_id=coordinator_id)
    row = result.data[0]
    row.pop("password_hash", None)
    return row


@router.delete("/{coordinator_id}")
def delete_coordinator(coordinator_id: str, claims: dict = Depends(require_admin)):
    # Unassign students first so the FK (on delete set null) doesn't orphan requests unexpectedly
    supabase.table("students").update({"coordinator_id": None}).eq(
        "coordinator_id", coordinator_id
    ).execute()
    result = supabase.table("coordinators").delete().eq("id", coordinator_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Coordinator not found")

    log_action("admin", claims["sub"], "COORDINATOR_DELETED",
               entity_type="coordinator", entity_id=coordinator_id)
    return {"message": "Coordinator deleted"}
