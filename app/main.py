import asyncio
import contextlib
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, Depends, status, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.auth import check_auth
from app.storage import load_settings, save_settings, load_history
from app.payments import (
    active_payments,
    archived_payments,
    parse_date,
    format_date,
    money_text,
    render_status,
    sort_key,
    is_soon,
    is_overdue_this_month,
    load_payments,
    save_payments,
)
from app.notifications import reminder_loop, add_history

app = FastAPI()
templates = Jinja2Templates(directory="templates")
templates.env.globals.update({
    "format_date": format_date,
    "money_text": money_text,
    "render_status": render_status,
    "sort_key": sort_key,
    "is_soon": is_soon,
    "is_overdue_this_month": is_overdue_this_month,
})
app.mount("/static", StaticFiles(directory="static"), name="static")


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(reminder_loop())
    try:
        yield
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


app.router.lifespan_context = lifespan


def compact_counts():
    today = datetime.now().date()
    urgent = 0
    soon = 0
    paid = 0

    for p in active_payments():
        try:
            d = parse_date(p.get("pay_date"))
        except Exception:
            continue
        delta = (d - today).days
        if delta < 0:
            paid += 1
        elif delta == 0:
            urgent += 1
        else:
            soon += 1

    return urgent, soon, paid


@app.get("/", response_class=HTMLResponse)
def index(request: Request, user: str = Depends(check_auth)):
    settings = load_settings()
    urgent_count, soon_count, paid_count = compact_counts()
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={
            "user": user,
            "settings": settings,
            "urgent_count": urgent_count,
            "soon_count": soon_count,
            "paid_count": paid_count,
        },
    )


@app.get("/payments", response_class=HTMLResponse)
def payments_page(request: Request, user: str = Depends(check_auth)):
    settings = load_settings()
    urgent_count, soon_count, paid_count = compact_counts()
    return templates.TemplateResponse(
        request=request,
        name="payments.html",
        context={
            "user": user,
            "settings": settings,
            "urgent_count": urgent_count,
            "soon_count": soon_count,
            "paid_count": paid_count,
            "payments": sorted(active_payments(), key=sort_key),
        },
    )


@app.get("/archive", response_class=HTMLResponse)
def archive_page(request: Request, user: str = Depends(check_auth)):
    settings = load_settings()
    urgent_count, soon_count, paid_count = compact_counts()
    return templates.TemplateResponse(
        request=request,
        name="archive.html",
        context={
            "user": user,
            "settings": settings,
            "urgent_count": urgent_count,
            "soon_count": soon_count,
            "paid_count": paid_count,
            "payments": archived_payments(),
        },
    )


@app.get("/history", response_class=HTMLResponse)
def history_page(request: Request, user: str = Depends(check_auth)):
    settings = load_settings()
    urgent_count, soon_count, paid_count = compact_counts()
    return templates.TemplateResponse(
        request=request,
        name="history.html",
        context={
            "user": user,
            "settings": settings,
            "urgent_count": urgent_count,
            "soon_count": soon_count,
            "paid_count": paid_count,
            "history": load_history(),
        },
    )


@app.get("/settings", response_class=HTMLResponse)
def settings_page(request: Request, user: str = Depends(check_auth)):
    settings = load_settings()
    urgent_count, soon_count, paid_count = compact_counts()
    return templates.TemplateResponse(
        request=request,
        name="settings.html",
        context={
            "user": user,
            "settings": settings,
            "urgent_count": urgent_count,
            "soon_count": soon_count,
            "paid_count": paid_count,
        },
    )


@app.post("/settings")
def save_settings_route(
    remind_days_before: int = Form(3),
    remind_time_1: str = Form("09:00"),
    remind_time_2: str = Form("18:00"),
    notify_due_day: str | None = Form(None),
    notify_month_end: str | None = Form(None),
    browser_notifications: str | None = Form(None),
    user: str = Depends(check_auth),
):
    settings = load_settings()
    settings["remind_days_before"] = remind_days_before
    settings["remind_time_1"] = remind_time_1
    settings["remind_time_2"] = remind_time_2
    settings["notify_due_day"] = notify_due_day is not None
    settings["notify_month_end"] = notify_month_end is not None
    settings["browser_notifications"] = browser_notifications is not None
    save_settings(settings)
    return RedirectResponse(url="/settings", status_code=status.HTTP_303_SEE_OTHER)


@app.post("/payments/add")
def add_payment(
    bank_name: str = Form(...),
    amount: float = Form(...),
    currency: str = Form("RUB"),
    pay_date: str = Form(...),
    comment: str = Form(""),
    user: str = Depends(check_auth),
):
    payments = load_payments()
    new_id = max([p["id"] for p in payments], default=0) + 1
    payments.append(
        {
            "id": new_id,
            "bank_name": bank_name,
            "amount": amount,
            "paid_amount": 0.0,
            "currency": currency,
            "pay_date": pay_date,
            "comment": comment,
        }
    )
    save_payments()
    add_history("add_payment", {"id": new_id, "bank_name": bank_name}, f"{bank_name} {amount} {currency}")
    return RedirectResponse(url="/payments", status_code=status.HTTP_303_SEE_OTHER)


@app.post("/payments/{payment_id}/delete")
def delete_payment(payment_id: int, user: str = Depends(check_auth)):
    payments = load_payments()
    payments[:] = [p for p in payments if p["id"] != payment_id]
    save_payments()
    add_history("delete_payment", {"id": payment_id}, "Удалён платеж")
    return RedirectResponse(url="/payments", status_code=status.HTTP_303_SEE_OTHER)


@app.get("/notifications/status")
def notifications_status(user: str = Depends(check_auth)):
    urgent_count, soon_count, paid_count = compact_counts()
    return {
        "items": [],
        "counts": {
            "urgent": urgent_count,
            "soon": soon_count,
            "paid": paid_count,
        },
    }


@app.post("/notifications/test")
def notifications_test(user: str = Depends(check_auth)):
    return {
        "ok": True,
        "items": [{
            "level": "soon",
            "text": "Тестовое уведомление: если ты это видишь, разрешение и показ работают.",
            "payment_id": None,
            "pay_date": datetime.now().strftime("%d.%m.%Y"),
        }]
    }