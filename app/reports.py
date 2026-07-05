from datetime import datetime

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from app.auth import check_auth
from app import payments as payments_module
from app.storage import load_settings

router = APIRouter()
templates = Jinja2Templates(directory="templates")
templates.env.globals["money_text"] = payments_module.money_text


def build_monthly_report():
    report = {}
    for p in payments_module.load_payments():
        try:
            dt = payments_module.parse_date(p.get("pay_date"))
        except Exception:
            continue

        key = f"{dt.year}-{dt.month:02d}"
        if key not in report:
            report[key] = {
                "month": key,
                "total_amount": 0.0,
                "total_paid": 0.0,
                "count": 0,
                "paid_count": 0,
                "partial_count": 0,
                "unpaid_count": 0,
            }

        amount = float(p.get("amount", 0))
        paid_amount = float(p.get("paid_amount", 0))

        report[key]["total_amount"] += amount
        report[key]["total_paid"] += paid_amount
        report[key]["count"] += 1

        if paid_amount <= 0:
            report[key]["unpaid_count"] += 1
        elif paid_amount < amount:
            report[key]["partial_count"] += 1
        else:
            report[key]["paid_count"] += 1

    return [report[k] for k in sorted(report.keys())]


@router.get("/reports", response_class=HTMLResponse)
def reports_page(request: Request, user: str = Depends(check_auth)):
    settings = load_settings()
    report = build_monthly_report()
    return templates.TemplateResponse(
        request=request,
        name="reports.html",
        context={
            "user": user,
            "settings": settings,
            "report": report,
        },
    )
