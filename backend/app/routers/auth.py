"""Authentication for coordinators and admins.

Parents never authenticate — see routers/parents.py.
"""
from fastapi import APIRouter, HTTPException

from app.core.database import supabase
from app.core.config import settings
from app.core.security import verify_password, create_access_token, hash_password
from app.models.schemas import CoordinatorLogin, AdminLogin, TokenResponse
from app.utils.audit import log_action

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/coordinator/login", response_model=TokenResponse)
def coordinator_login(payload: CoordinatorLogin):
    res = (
        supabase.table("coordinators")
        .select("*")
        .eq("email", payload.email)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    coordinator = res.data[0]
    if not coordinator.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is disabled")

    if not verify_password(payload.password, coordinator["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(subject=coordinator["id"], role="coordinator")
    log_action("coordinator", coordinator["id"], "LOGIN")

    return TokenResponse(
        access_token=token, role="coordinator",
        name=coordinator["name"], id=coordinator["id"],
    )


@router.post("/admin/login", response_model=TokenResponse)
def admin_login(payload: AdminLogin):
    res = (
        supabase.table("admins")
        .select("*")
        .eq("email", payload.email)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    admin = res.data[0]
    if not verify_password(payload.password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(subject=admin["id"], role=admin.get("role", "admin"))
    log_action("admin", admin["id"], "LOGIN")

    return TokenResponse(
        access_token=token, role=admin.get("role", "admin"),
        name=admin["name"], id=admin["id"],
    )


@router.post("/bootstrap-admin", status_code=201)
def bootstrap_admin(name: str, email: str, password: str, secret: str):
    """One-time endpoint to create the first superadmin account.

    Disabled automatically once any admin row exists, and requires the
    BOOTSTRAP_SECRET env var to match. Call this once right after deploying,
    then treat the endpoint as dead (it will always 403 afterwards).
    """
    if secret != settings.bootstrap_secret or not settings.bootstrap_secret:
        raise HTTPException(status_code=403, detail="Invalid bootstrap secret")

    existing = supabase.table("admins").select("id").limit(1).execute()
    if existing.data:
        raise HTTPException(status_code=403, detail="An admin already exists")

    result = supabase.table("admins").insert({
        "name": name,
        "email": email,
        "password_hash": hash_password(password),
        "role": "superadmin",
    }).execute()

    return {"message": "Superadmin created", "id": result.data[0]["id"]}
