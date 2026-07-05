from pathlib import Path
import json
from datetime import datetime, date
import calendar

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

PAYMENTS_FILE = DATA_DIR / "payments.json"


def load_json_file(path, default):
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            return default
    return default


def save_json_file(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


payments = load_json_file(PAYMENTS_FILE, [])


CURRENCY_SYMBOLS = {
    "RUB": "₽",
    "USD": "$",
    "EUR": "€",
}


MONTHS_RU = {
    1: "янв",
    2: "фев",
    3: "мар",
    4: "апр",
    5: "мая",
    6: "июн",
    7: "июл",
    8: "авг",
    9: "сен",
    10: "окт",
    11: "ноя",
    12: "дек",
}


def load_payments():
    global payments
    payments = load_json_file(PAYMENTS_FILE, [])
    return payments


def save_payments():
    save_json_file(PAYMENTS_FILE, payments)


def parse_date(date_str):
    return datetime.strptime(date_str, "%Y-%m-%d").date()


def format_number(value: float) -> str:
    return f"{value:,.2f}".replace(",", " ")


def format_date(date_str: str) -> str:
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return f"{dt.day} {MONTHS_RU[dt.month]} {dt.year}"
    except:
        return date_str


def get_currency_symbol(code: str) -> str:
    return CURRENCY_SYMBOLS.get(code, code)


def money_text(value: float, currency: str) -> str:
    return f"{format_number(value)} {get_currency_symbol(currency)}"


def next_payment_id():
    return max([p["id"] for p in payments], default=0) + 1


def find_payment(payment_id: int):
    for p in payments:
        if p["id"] == payment_id:
            return p
    return None


def is_paid(p):
    return p.get("paid_amount", 0) >= p.get("amount", 0)


def render_status(p):
    if p.get("paid_amount", 0) <= 0:
        return "не оплачен", "status-unpaid"
    if p.get("paid_amount", 0) < p.get("amount", 0):
        return "частично оплачен", "status-partial"
    return "оплачен", "status-paid"


def is_overdue_this_month(p, today=None):
    today = today or date.today()
    if is_paid(p):
        return False
    try:
        d = parse_date(p["pay_date"])
    except:
        return False
    return d.year == today.year and d.month == today.month and d.day == calendar.monthrange(today.year, today.month)[1]


def is_soon(p, remind_days_before=3):
    try:
        d = parse_date(p["pay_date"])
    except:
        return False
    today = date.today()
    delta = (d - today).days
    return 0 <= delta <= int(remind_days_before) and not is_paid(p)


def sort_key(p):
    try:
        d = parse_date(p["pay_date"])
    except:
        d = date.max
    return (
        0 if is_overdue_this_month(p) else 1 if is_soon(p) else 2,
        d.isoformat(),
        p["id"],
    )


def archived_payments():
    return [p for p in payments if is_paid(p)]


def active_payments():
    return [p for p in payments if not is_paid(p)]


def build_monthly_report():
    report = {}
    for p in payments:
        try:
            dt = datetime.strptime(p["pay_date"], "%Y-%m-%d")
        except:
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
        report[key]["total_amount"] += float(p.get("amount", 0))
        report[key]["total_paid"] += float(p.get("paid_amount", 0))
        report[key]["count"] += 1
        if p.get("paid_amount", 0) <= 0:
            report[key]["unpaid_count"] += 1
        elif p.get("paid_amount", 0) < p.get("amount", 0):
            report[key]["partial_count"] += 1
        else:
            report[key]["paid_count"] += 1

    return [report[k] for k in sorted(report.keys())]