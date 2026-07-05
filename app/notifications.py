from app import storage, payments
from datetime import datetime
from pathlib import Path
import json

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)
LAST_NOTIFY_FILE = DATA_DIR / "last_notify.json"


def _load_last_notify():
    if LAST_NOTIFY_FILE.exists():
        try:
            with open(LAST_NOTIFY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def _save_last_notify(data):
    with open(LAST_NOTIFY_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _get_remind_settings():
    settings = storage.load_settings()
    times = [
        settings.get('remind_time_1', '09:00'),
        settings.get('remind_time_2', '18:00')
    ]
    days = int(settings.get('remind_days_before', 3))
    return times, days


def _build_items(today, days_before, test=False):
    all_payments = payments.load_payments()
    items = []
    for p in all_payments:
        if p.get('archived', False) or payments.is_paid(p):
            continue
        try:
            due_date = datetime.strptime(p['pay_date'], '%Y-%m-%d').date()
        except Exception:
            continue
        days_left = (due_date - today).days
        if days_left < 0:
            continue
        if not test and days_left > days_before:
            continue
        name = p.get('name', p.get('bank_name', 'Без названия'))
        text = f"Платёж '{name}' нужно оплатить {due_date.strftime('%d.%m.%Y')}"
        if days_left > 0:
            text += f" (через {days_left} дн.)"
        elif days_left == 0:
            text += " (сегодня)"
        items.append({"text": text, "payment_id": p["id"]})
    return items


# ---------- Для браузерного polling ----------
def get_pending_notifications(test=False):
    if not test:
        settings = storage.load_settings()
        if not settings.get('notifications_enabled', False):
            return {"items": [], "trigger": None}

    now = datetime.now()
    remind_times, notify_days = _get_remind_settings()

    trigger = None
    cur_total = now.hour * 60 + now.minute
    for rt in remind_times:
        try:
            h, m = map(int, rt.split(':'))
            rt_total = h * 60 + m
            if abs(cur_total - rt_total) <= 2:
                trigger = rt
                break
        except Exception:
            continue

    if not test and not trigger:
        return {"items": [], "trigger": None}

    items = _build_items(now.date(), notify_days, test=test)
    return {"items": items, "trigger": trigger}


# ---------- Для фонового потока (Windows desktop) ----------
def send_desktop_notifications():
    settings = storage.load_settings()
    if not settings.get('notifications_enabled', False):
        return {"sent": 0, "trigger": None}

    now = datetime.now()
    current_time = now.strftime("%H:%M")
    remind_times, notify_days = _get_remind_settings()
    today = now.date().isoformat()

    matched_time = None
    for rt in remind_times:
        if current_time == rt:
            matched_time = rt
            break

    if not matched_time:
        return {"sent": 0, "trigger": None}

    last = _load_last_notify()
    # Блокируем только если уже отправляли в ЭТО ЖЕ время сегодня
    if last.get("date") == today and last.get("time") == matched_time:
        return {"sent": 0, "trigger": matched_time}

    items = _build_items(now.date(), notify_days)
    if not items:
        _save_last_notify({"date": today, "time": matched_time})
        return {"sent": 0, "trigger": matched_time}

    for item in items:
        _desktop_notify("Payment Reminder", item["text"])
        print(f"[УВЕДОМЛЕНИЕ] {item['text']}")

    _save_last_notify({"date": today, "time": matched_time})
    return {"sent": len(items), "trigger": matched_time}


def _desktop_notify(title, message):
    try:
        from plyer import notification
        notification.notify(title=title, message=message, timeout=10)
        return
    except Exception:
        pass
    try:
        from win10toast import ToastNotifier
        t = ToastNotifier()
        t.show_toast(title, message, duration=10, threaded=True)
    except Exception:
        pass