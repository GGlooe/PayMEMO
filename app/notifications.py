from app import storage, payments
from datetime import datetime

def send_notifications():
    settings = storage.load_settings()
    if not settings.get('notifications_enabled', False):
        return 0

    all_payments = payments.load_payments()
    sent_log = storage.load_sent_log()
    now = datetime.now().date()
    notify_days_before = int(settings.get('remind_days_before', 3))
    sent_count = 0

    for p in all_payments:
        if p.get('archived', False) or payments.is_paid(p):
            continue
        try:
            due_date = datetime.strptime(p['pay_date'], '%Y-%m-%d').date()
        except:
            continue
        days_left = (due_date - now).days
        if days_left < 0:
            continue

        log_key = f"{p['id']}_{now.isoformat()}"
        if log_key in sent_log:
            continue

        if days_left <= notify_days_before:
            name = p.get('name', p.get('bank_name', 'Без названия'))
            print(f"[УВЕДОМЛЕНИЕ] Платёж '{name}' нужно оплатить {due_date} (через {days_left} дн.)")
            sent_log.append(log_key)
            sent_count += 1

    storage.save_sent_log(sent_log)
    return sent_count