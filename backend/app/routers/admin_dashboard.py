"""Admin analytics dashboard and reports (daily/weekly/monthly/custom,
Excel + PDF export)."""
import io
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

from app.core.database import supabase
from app.core.security import require_admin

router = APIRouter(prefix="/api/admin", tags=["admin-dashboard"])


def _fetch_requests(start: datetime, end: datetime):
    res = (
        supabase.table("pickup_requests")
        .select("*, students(name, student_id, class, section), coordinators(name)")
        .gte("request_time", start.isoformat())
        .lte("request_time", end.isoformat())
        .execute()
    )
    return res.data


@router.get("/dashboard-stats")
def dashboard_stats(claims: dict = Depends(require_admin)):
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)
    rows = _fetch_requests(today, tomorrow)

    pending = sum(1 for r in rows if r["status"] == "pending")
    sent = sum(1 for r in rows if r["status"] == "sent")

    response_times = []
    hour_counter = Counter()
    class_counter = Counter()
    coordinator_counter = Counter()

    for r in rows:
        req_time = datetime.fromisoformat(r["request_time"].replace("Z", "+00:00"))
        hour_counter[req_time.hour] += 1

        student = r.get("students") or {}
        if student.get("class"):
            class_counter[student["class"]] += 1

        coordinator = r.get("coordinators") or {}
        if coordinator.get("name"):
            coordinator_counter[coordinator["name"]] += 1

        if r.get("sent_time"):
            sent_time = datetime.fromisoformat(r["sent_time"].replace("Z", "+00:00"))
            response_times.append((sent_time - req_time).total_seconds())

    avg_response = sum(response_times) / len(response_times) if response_times else None
    peak_hour = hour_counter.most_common(1)[0][0] if hour_counter else None

    return {
        "todays_requests": len(rows),
        "pending": pending,
        "sent": sent,
        "avg_response_seconds": avg_response,
        "peak_hour": peak_hour,
        "requests_by_class": dict(class_counter),
        "requests_by_coordinator": dict(coordinator_counter),
    }


def _range_for_report(period: str, start: Optional[str], end: Optional[str]):
    now = datetime.now(timezone.utc)
    if period == "daily":
        s = now.replace(hour=0, minute=0, second=0, microsecond=0)
        e = s + timedelta(days=1)
    elif period == "weekly":
        s = now - timedelta(days=now.weekday())
        s = s.replace(hour=0, minute=0, second=0, microsecond=0)
        e = s + timedelta(days=7)
    elif period == "monthly":
        s = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        next_month = (s.replace(day=28) + timedelta(days=4)).replace(day=1)
        e = next_month
    elif period == "custom":
        if not start or not end:
            raise ValueError("start and end are required for custom period")
        s = datetime.fromisoformat(start).replace(tzinfo=timezone.utc)
        e = datetime.fromisoformat(end).replace(tzinfo=timezone.utc) + timedelta(days=1)
    else:
        raise ValueError("Invalid period")
    return s, e


@router.get("/reports")
def get_report(
    period: str = Query("daily", pattern="^(daily|weekly|monthly|custom)$"),
    start: Optional[str] = None,
    end: Optional[str] = None,
    claims: dict = Depends(require_admin),
):
    s, e = _range_for_report(period, start, end)
    rows = _fetch_requests(s, e)

    report_rows = []
    for r in rows:
        student = r.get("students") or {}
        coordinator = r.get("coordinators") or {}
        report_rows.append({
            "Student": student.get("name"),
            "Student ID": student.get("student_id"),
            "Class": student.get("class"),
            "Section": student.get("section"),
            "Coordinator": coordinator.get("name"),
            "Request Time": r["request_time"],
            "Sent Time": r.get("sent_time"),
            "Status": r["status"],
        })

    return {"period": period, "start": s.isoformat(), "end": e.isoformat(),
            "count": len(report_rows), "rows": report_rows}


@router.get("/reports/export/excel")
def export_report_excel(
    period: str = Query("daily", pattern="^(daily|weekly|monthly|custom)$"),
    start: Optional[str] = None,
    end: Optional[str] = None,
    claims: dict = Depends(require_admin),
):
    data = get_report(period=period, start=start, end=end, claims=claims)
    df = pd.DataFrame(data["rows"])
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Report")
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=pickup_report_{period}.xlsx"},
    )


@router.get("/reports/export/pdf")
def export_report_pdf(
    period: str = Query("daily", pattern="^(daily|weekly|monthly|custom)$"),
    start: Optional[str] = None,
    end: Optional[str] = None,
    claims: dict = Depends(require_admin),
):
    data = get_report(period=period, start=start, end=end, claims=claims)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4)
    styles = getSampleStyleSheet()
    elements = [
        Paragraph(f"Pickup Report — {period.capitalize()}", styles["Title"]),
        Paragraph(f"Range: {data['start']} to {data['end']}", styles["Normal"]),
        Paragraph(f"Total requests: {data['count']}", styles["Normal"]),
        Spacer(1, 12),
    ]

    table_data = [["Student", "ID", "Class", "Section", "Coordinator", "Requested At", "Sent At", "Status"]]
    for row in data["rows"]:
        req_time = row["Request Time"]
        sent_time = row["Sent Time"]
        req_str = req_time[:16].replace("T", " ") if req_time else "-"
        sent_str = sent_time[:16].replace("T", " ") if sent_time else "-"
        table_data.append([
            row["Student"] or "", row["Student ID"] or "", row["Class"] or "",
            row["Section"] or "", row["Coordinator"] or "", req_str, sent_str,
            row["Status"] or "",
        ])

    table = Table(table_data, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
    ]))
    elements.append(table)
    doc.build(elements)
    buf.seek(0)

    return StreamingResponse(
        buf, media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=pickup_report_{period}.pdf"},
    )
