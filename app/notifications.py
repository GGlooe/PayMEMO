import asyncio
from datetime import datetime

from app.storage import load_settings, load_history, save_history
from app.payments import active_payments, money_text, parse_date

_sent_keys = set()


def add_history(action, payment=None, details=""):
    history = load_history()
    history.insert(0, {
        "ts": datetime.now().isoformat(timespec="seconds"),
        "action": action,
        "payment_id": payment.get("id") if payment else None,
        "bank_name": payment.get("bank_name", "") if payment else "",
        "details": details,
    })
    del history[1000:]
    save_history(history)


def _parse_hhmm(value):
    try:
        h, m = value.split(":")
        return int(h), int(m)
    except Exception:
        return None


def _time_matches(now_dt, target_hm, minutes_window=2):
    if not target_hm:
        return False
    th, tm = target_hm
    target = th * 60 + tm
    now = now_dt.hour * 60 + now_dt.minute
    return abs(now - target) <= minutes_window


def should_notify(payment, settings, now_dt=None):
    now_dt = now_dt or datetime.now()
    due = parse_date(payment.get("pay_date"))
    days_before = int(settings.get("remind_days_before", 3))
    delta_days = (due - now_dt.date()).days

    if delta_days < 0:
        return False
    if delta_days > days_before:
        return False

    t1 = _parse_hhmm(settings.get("remind_time_1", "09:00"))
    t2 = _parse_hhmm(settings.get("remind_time_2", "18:00"))

    if not t1 and not t2:
        return True

    return _time_matches(now_dt, t1) or _time_matches(now_dt, t2)


def notification_key(payment, now_dt):
    return (
        payment.get("id"),
        now_dt.date().isoformat(),
        now_dt.hour,
        now_dt.minute // 10,
    )


async def reminder_loop():
    global _sent_keys
    while True:
        try:
            now_dt = datetime.now()
            settings = load_settings()

            if settings.get("browser_notifications", True):
                for p in active_payments():
                    if should_notify(p, settings, now_dt):
                        key = notification_key(p, now_dt)
                        if key not in _sent_keys:
                            add_history("notification", p, f"Уведомление: {parse_date(p.get('pay_date')).strftime('%d.%m.%Y')}")
                            _sent_keys.add(key)

                if len(_sent_keys) > 2000:
                    _sent_keys = set(list(_sent_keys)[-500:])
        except asyncio.CancelledError:
            break
        except Exception:
            pass

        await asyncio.sleep(30)