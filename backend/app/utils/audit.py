"""Write an entry to audit_logs. Best-effort — never blocks the main flow."""
from app.core.database import supabase


def log_action(actor_type: str, actor_id: str | None, action: str,
                entity_type: str | None = None, entity_id: str | None = None,
                metadata: dict | None = None) -> None:
    try:
        supabase.table("audit_logs").insert({
            "actor_type": actor_type,
            "actor_id": actor_id,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "metadata": metadata or {},
        }).execute()
    except Exception:
        # Audit logging must never break the primary request flow.
        pass
