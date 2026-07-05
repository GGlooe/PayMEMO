from pathlib import Path
import json
from datetime import datetime

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

SETTINGS_FILE = DATA_DIR / "settings.json"
HISTORY_FILE = DATA_DIR / "history.json"
SENT_LOG_FILE = DATA_DIR / "sent_log.json"

DEFAULT_SETTINGS = {
    "remind_days_before": 3,
    "remind_time_1": "09:00",
    "remind_time_2": "18:00",
    "notify_due_day": True,
    "notify_month_end": True,
    "browser_notifications": True,
    "check_interval_minutes": 30,
    "notifications_enabled": True,
}

def load_json(path, default):
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            return default
    return default

def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# ---------- Настройки ----------
def load_settings():
    data = load_json(SETTINGS_FILE, DEFAULT_SETTINGS.copy())
    merged = DEFAULT_SETTINGS.copy()
    merged.update(data)
    return merged

def save_settings(settings):
    save_json(SETTINGS_FILE, settings)

# ---------- История ----------
def load_history():
    return load_json(HISTORY_FILE, [])

def save_history(history):
    save_json(HISTORY_FILE, history)

def add_history_entry(action: str, bank_name: str, details: str):
    history = load_history()
    history.append({
        "ts": datetime.now().isoformat(),
        "action": action,
        "bank_name": bank_name,
        "details": details
    })
    save_history(history)

# ---------- Лог отправленных уведомлений ----------
def load_sent_log():
    log = load_json(SENT_LOG_FILE, [])
    if not isinstance(log, list):
        log = []
    return log

def save_sent_log(log):
    save_json(SENT_LOG_FILE, log)