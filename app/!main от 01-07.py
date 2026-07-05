from fastapi import FastAPI, Depends, HTTPException, status, Form
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from datetime import datetime, date
from pathlib import Path
import secrets
import html
import json
import calendar

app = FastAPI()
security = HTTPBasic()

USERNAME = "admin"
PASSWORD = "1234"

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)
PAYMENTS_FILE = DATA_DIR / "payments.json"
SETTINGS_FILE = DATA_DIR / "settings.json"

CURRENCY_SYMBOLS = {"RUB": "₽", "USD": "$", "EUR": "€"}
MONTHS_RU = {
    1: "янв", 2: "фев", 3: "мар", 4: "апр", 5: "мая", 6: "июн",
    7: "июл", 8: "авг", 9: "сен", 10: "окт", 11: "ноя", 12: "дек"
}
DEFAULT_SETTINGS = {
    "remind_days_before": 3,
    "remind_time_1": "09:00",
    "remind_time_2": "18:00",
    "notify_due_day": True,
    "notify_month_end": True,
    "browser_notifications": False
}

def check_auth(credentials: HTTPBasicCredentials = Depends(security)):
    user_ok = secrets.compare_digest(credentials.username, USERNAME)
    pass_ok = secrets.compare_digest(credentials.password, PASSWORD)
    if not (user_ok and pass_ok):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

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
settings = load_json_file(SETTINGS_FILE, DEFAULT_SETTINGS.copy())

def save_payments():
    save_json_file(PAYMENTS_FILE, payments)

def save_settings():
    save_json_file(SETTINGS_FILE, settings)

def next_payment_id():
    return max([p["id"] for p in payments], default=0) + 1

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

def find_payment(payment_id: int):
    for p in payments:
        if p["id"] == payment_id:
            return p
    return None

def render_status(p):
    if p["paid_amount"] <= 0:
        return "не оплачен", "status-unpaid"
    if p["paid_amount"] < p["amount"]:
        return "частично оплачен", "status-partial"
    return "оплачен", "status-paid"

def is_paid(p):
    return p["paid_amount"] >= p["amount"]

def is_overdue_this_month(p, today=None):
    today = today or date.today()
    if is_paid(p):
        return False
    try:
        d = datetime.strptime(p["pay_date"], "%Y-%m-%d").date()
    except:
        return False
    return d.year == today.year and d.month == today.month and d.day == calendar.monthrange(today.year, today.month)[1]

def is_soon(p):
    try:
        d = datetime.strptime(p["pay_date"], "%Y-%m-%d").date()
    except:
        return False
    today = date.today()
    delta = (d - today).days
    return 0 <= delta <= int(settings.get("remind_days_before", 3)) and not is_paid(p)

def sort_key(p):
    return (
        0 if is_overdue_this_month(p) else 1 if is_soon(p) else 2,
        p["pay_date"],
        p["id"]
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
                "month": key, "total_amount": 0.0, "total_paid": 0.0,
                "count": 0, "paid_count": 0, "partial_count": 0, "unpaid_count": 0,
            }
        report[key]["total_amount"] += p["amount"]
        report[key]["total_paid"] += p["paid_amount"]
        report[key]["count"] += 1
        if p["paid_amount"] <= 0:
            report[key]["unpaid_count"] += 1
        elif p["paid_amount"] < p["amount"]:
            report[key]["partial_count"] += 1
        else:
            report[key]["paid_count"] += 1
    return [report[k] for k in sorted(report.keys())]

def render_theme_toggle():
    return """
    <button class="icon-btn" id="themeToggle" type="button" aria-label="Переключить тему">🌙</button>
    <script>
        const root = document.documentElement;
        const btn = document.getElementById('themeToggle');
        const savedTheme = localStorage.getItem('theme') || 'light';
        root.setAttribute('data-theme', savedTheme);
        btn.textContent = savedTheme === 'light' ? '🌙' : '☀️';
        btn.addEventListener('click', () => {
            const current = root.getAttribute('data-theme') || 'light';
            const next = current === 'light' ? 'dark' : 'light';
            root.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
            btn.textContent = next === 'light' ? '🌙' : '☀️';
        });
    </script>
    """

def toolbar(active=""):
    def item(label, href, key):
        cls = "nav-btn active" if active == key else "nav-btn"
        return f'<a class="{cls}" href="{href}">{label}</a>'
    return f"""
    <div class="toolbar">
        <div class="nav-left">
            {item("Главная", "/", "home")}
            {item("Платежи", "/payments", "payments")}
            {item("Создать", "/panel", "panel")}
            {item("Архив", "/archive", "archive")}
            {item("Отчеты", "/reports", "reports")}
        </div>
        <div class="nav-right">
            {render_theme_toggle()}
            <a class="icon-btn" href="/settings" aria-label="Настройки">⚙</a>
        </div>
    </div>
    """

def base_css():
    return """
    :root {
        --bg:#f4f6f8; --card:#fff; --text:#222; --muted:#5f6b7a; --line:#dde3ea;
        --head:#eef3ff; --primary:#2d6cdf; --primary-hover:#2459b8; --link:#2d6cdf;
        --input-bg:#fff; --input-text:#222; --nav-bg:rgba(255,255,255,0.72); --nav-border:#dbe3ee;
        --nav-text:#344256; --nav-active-bg:#2d6cdf; --nav-active-text:#fff; --icon-bg:#fff; --icon-text:#222;
        --status-unpaid-bg:#f7dbe4; --status-unpaid-text:#8a2d4e; --status-partial-bg:#f8edcf;
        --status-partial-text:#8a6a1f; --status-paid-bg:#d9efdf; --status-paid-text:#2f6b42;
        --status-urgent-bg:#efd1df; --status-urgent-text:#7c2948;
    }
    :root[data-theme="dark"] {
        --bg:#16181d; --card:#1f232b; --text:#e7e9ee; --muted:#c7cbd6; --line:#343947;
        --head:#262b33; --primary:#5b7cff; --primary-hover:#4967df; --link:#8ea0ff;
        --input-bg:#2a2f38; --input-text:#e7e9ee; --nav-bg:rgba(31,35,43,0.85); --nav-border:#3b4250;
        --nav-text:#dfe4f3; --nav-active-bg:#5b7cff; --nav-active-text:#fff; --icon-bg:#2a2f38; --icon-text:#e7e9ee;
        --status-unpaid-bg:#3a1e2a; --status-unpaid-text:#f0b3c5; --status-partial-bg:#3d3520;
        --status-partial-text:#ead49a; --status-paid-bg:#1f3a2a; --status-paid-text:#b9e2c8;
        --status-urgent-bg:#4a2134; --status-urgent-text:#f1b8cb;
    }
    body { font-family: Arial, sans-serif; background: var(--bg); margin: 0; color: var(--text); }
    .box, .container { max-width: 1200px; margin: 18px auto; background: var(--card); padding: 20px; border-radius: 18px; box-shadow: 0 10px 30px rgba(0,0,0,0.12); }
    .toolbar { display:flex; justify-content:space-between; gap:10px; align-items:center; padding:6px 8px; margin-bottom:16px; border:1px solid var(--nav-border); background:var(--nav-bg); border-radius:14px; backdrop-filter: blur(10px); flex-wrap: wrap; }
    .nav-left, .nav-right { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .nav-btn, .icon-btn { display:inline-flex; align-items:center; justify-content:center; height:36px; padding:0 13px; border-radius:999px; border:1px solid var(--nav-border); text-decoration:none; color:var(--nav-text); background:transparent; font-weight:700; transition:0.2s ease; }
    .nav-btn:hover, .icon-btn:hover { transform: translateY(-1px); background: rgba(91,124,255,0.10); }
    .nav-btn.active { background: var(--nav-active-bg); color: var(--nav-active-text); border-color: transparent; }
    .icon-btn { width:36px; padding:0; background:var(--icon-bg); color:var(--icon-text); }
    label { display:block; margin-top:10px; font-weight:bold; }
    input, select, button { width:100%; padding:12px; margin:8px 0 16px 0; border-radius:10px; border:1px solid var(--line); box-sizing:border-box; background:var(--input-bg); color:var(--input-text); }
    button { background: var(--primary); color:#fff; font-weight:bold; cursor:pointer; border:none; }
    button:hover { background: var(--primary-hover); }
    table { width:100%; border-collapse:collapse; margin-top:20px; }
    th, td { border:1px solid var(--line); padding:10px; text-align:left; vertical-align:middle; }
    th { background: var(--head); color: var(--text); }
    .badge { display:inline-block; padding:6px 10px; border-radius:999px; font-size:13px; font-weight:bold; white-space:nowrap; }
    .status-unpaid { background: var(--status-unpaid-bg); color: var(--status-unpaid-text); }
    .status-partial { background: var(--status-partial-bg); color: var(--status-partial-text); }
    .status-paid { background: var(--status-paid-bg); color: var(--status-paid-text); }
    .status-urgent { background: var(--status-urgent-bg); color: var(--status-urgent-text); }
    .archive-note { margin-top:8px; color:var(--muted); font-size:14px; }
    .settings-row { display:flex; align-items:center; gap:10px; margin:10px 0; }
    .settings-row input[type="checkbox"] { width:auto; margin:0; transform: translateY(1px); }
    .settings-row label { margin:0; font-weight: normal; }
    .small-note { color: var(--muted); font-size: 14px; }
    """

def render_page(title, active, body):
    return f"""<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>{title}</title><style>{base_css()}</style></head><body><div class="box">{toolbar(active)}{body}</div></body></html>"""

@app.get("/", response_class=HTMLResponse)
def home():
    body = """
    <h1>Платежный помощник</h1>
    <p>Система учета платежей, напоминаний и сумм по банкам.</p>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
        <a class="nav-btn active" href="/panel" style="justify-content:center;">Создать платеж</a>
        <a class="nav-btn" href="/payments" style="justify-content:center;">Список платежей</a>
        <a class="nav-btn" href="/reports" style="justify-content:center;">Отчеты</a>
        <a class="nav-btn" href="/archive" style="justify-content:center;">Архив</a>
    </div>
    """
    return render_page("Платежный помощник", "home", body)

@app.get("/panel", response_class=HTMLResponse)
def panel(user: str = Depends(check_auth)):
    rows = ""
    for p in sorted(active_payments(), key=sort_key):
        status_label, status_class = render_status(p)
        if is_overdue_this_month(p):
            status_label, status_class = "срочно", "status-urgent"
        elif is_soon(p):
            status_label, status_class = "скоро", "status-partial"
        rows += f"""<tr><td>{html.escape(p['bank_name'])}</td><td>{money_text(p['amount'], p['currency'])}</td><td>{money_text(p['paid_amount'], p['currency'])}</td><td><span class="badge {status_class}">{status_label}</span></td><td>{format_date(p['pay_date'])}</td><td>{html.escape(p['comment'])}</td><td><a class="edit-link" href="/edit/{p['id']}">✏️</a></td></tr>"""
    body = f"""
    <h1>Защищенная панель</h1><p>Пользователь: {user}</p>
    <h2>Добавить платеж</h2>
    <form action="/add_payment" method="post">
        <label for="bank_name">Наименование банка</label><input id="bank_name" type="text" name="bank_name" required>
        <label for="amount">Сумма платежа</label><input id="amount" type="number" step="0.01" name="amount" required>
        <label for="currency">Валюта</label>
        <select id="currency" name="currency"><option value="RUB">RUB — рубль</option><option value="USD">USD — доллар</option><option value="EUR">EUR — евро</option></select>
        <label for="pay_date">Дата платежа</label><input id="pay_date" type="date" name="pay_date" required>
        <label for="comment">Комментарий</label><input id="comment" type="text" name="comment">
        <button type="submit">Добавить</button>
    </form>
    <h2>Последние платежи</h2>
    <table><tr><th>Банк</th><th>Сумма</th><th>Оплачено</th><th>Статус</th><th>Дата</th><th>Комментарий</th><th></th></tr>{rows}</table>
    """
    return render_page("Панель", "panel", body)

@app.post("/add_payment")
def add_payment(bank_name: str = Form(...), amount: float = Form(...), currency: str = Form("RUB"), pay_date: str = Form(...), comment: str = Form("")):
    payments.append({"id": next_payment_id(), "bank_name": bank_name, "amount": amount, "paid_amount": 0.0, "currency": currency, "pay_date": pay_date, "comment": comment})
    save_payments()
    return RedirectResponse(url="/panel", status_code=status.HTTP_303_SEE_OTHER)

@app.get("/payments", response_class=HTMLResponse)
def payments_page(user: str = Depends(check_auth)):
    rows = ""
    for p in sorted(active_payments(), key=sort_key):
        status_label, status_class = render_status(p)
        if is_overdue_this_month(p):
            status_label, status_class = "срочно", "status-urgent"
        elif is_soon(p):
            status_label, status_class = "скоро", "status-partial"
        rows += f"""<tr><td>{html.escape(p['bank_name'])}</td><td>{money_text(p['amount'], p['currency'])}</td><td>{money_text(p['paid_amount'], p['currency'])}</td><td><span class="badge {status_class}">{status_label}</span></td><td>{format_date(p['pay_date'])}</td><td>{html.escape(p['comment'])}</td><td><a class="edit-link" href="/edit/{p['id']}">✏️</a></td></tr>"""
    body = f"""<h1>Список платежей</h1><p>Пользователь: {user}</p><table><tr><th>Банк</th><th>Сумма</th><th>Оплачено</th><th>Статус</th><th>Дата</th><th>Комментарий</th><th></th></tr>{rows}</table>"""
    return render_page("Платежи", "payments", body)

@app.get("/archive", response_class=HTMLResponse)
def archive_page(user: str = Depends(check_auth)):
    rows = ""
    for p in sorted(archived_payments(), key=lambda x: (x["pay_date"], x["id"]), reverse=True):
        rows += f"""<tr><td>{html.escape(p['bank_name'])}</td><td>{money_text(p['amount'], p['currency'])}</td><td>{money_text(p['paid_amount'], p['currency'])}</td><td><span class="badge status-paid">оплачен</span></td><td>{format_date(p['pay_date'])}</td><td>{html.escape(p['comment'])}</td><td><a class="edit-link" href="/edit/{p['id']}">✏️</a></td></tr>"""
    body = f"""<h1>Архив оплаченных платежей</h1><p class="archive-note">Оплаченные платежи переходят сюда и используются для анализа.</p><table><tr><th>Банк</th><th>Сумма</th><th>Оплачено</th><th>Статус</th><th>Дата</th><th>Комментарий</th><th></th></tr>{rows}</table>"""
    return render_page("Архив", "archive", body)

@app.get("/reports", response_class=HTMLResponse)
def reports_page(user: str = Depends(check_auth)):
    total_amount = sum(p["amount"] for p in payments)
    total_paid = sum(p["paid_amount"] for p in payments)
    rows = ""
    for r in build_monthly_report():
        y, m = map(int, r["month"].split("-"))
        rows += f"""<tr><td>{MONTHS_RU[m]} {y}</td><td>{format_number(r['total_amount'])}</td><td>{format_number(r['total_paid'])}</td><td>{r['count']}</td><td>{r['paid_count']}</td><td>{r['partial_count']}</td><td>{r['unpaid_count']}</td></tr>"""
    body = f"""<h1>Помесячный отчет</h1><p>Пользователь: {user}</p><p><b>Всего начислено:</b> {format_number(total_amount)}</p><p><b>Всего оплачено:</b> {format_number(total_paid)}</p><table><tr><th>Месяц</th><th>Начислено</th><th>Оплачено</th><th>Всего платежей</th><th>Оплачено</th><th>Частично</th><th>Не оплачено</th></tr>{rows}</table>"""
    return render_page("Отчеты", "reports", body)

@app.get("/settings", response_class=HTMLResponse)
def settings_page(user: str = Depends(check_auth)):
    body = f"""
    <h1>Настройки</h1><p>Пользователь: {user}</p>
    <form action="/settings" method="post">
        <label for="remind_days_before">Напоминать за сколько дней</label>
        <input id="remind_days_before" type="number" min="0" max="30" name="remind_days_before" value="{settings.get('remind_days_before', 3)}">

        <label for="remind_time_1">Время напоминания 1</label>
        <input id="remind_time_1" type="time" name="remind_time_1" value="{settings.get('remind_time_1', '09:00')}">

        <label for="remind_time_2">Время напоминания 2</label>
        <input id="remind_time_2" type="time" name="remind_time_2" value="{settings.get('remind_time_2', '18:00')}">

        <div class="settings-row"><input id="notify_due_day" type="checkbox" name="notify_due_day" {"checked" if settings.get("notify_due_day", True) else ""}><label for="notify_due_day">Напоминать в день платежа</label></div>
        <div class="settings-row"><input id="notify_month_end" type="checkbox" name="notify_month_end" {"checked" if settings.get("notify_month_end", True) else ""}><label for="notify_month_end">Напоминать в последний день месяца</label></div>
        <div class="settings-row"><input id="browser_notifications" type="checkbox" name="browser_notifications" {"checked" if settings.get("browser_notifications", False) else ""}><label for="browser_notifications">Браузерные уведомления</label></div>
        <button type="submit">Сохранить</button>
    </form>

    <h2>Проверка уведомления</h2>
    <p class="small-note">Нажми кнопку, чтобы браузер показал тестовое уведомление.</p>
    <button type="button" onclick="testNotify()">Проверить уведомление</button>

    <script>
    async function testNotify() {{
        if (!("Notification" in window)) {{
            alert("Этот браузер не поддерживает уведомления");
            return;
        }}
        if (Notification.permission !== "granted") {{
            const perm = await Notification.requestPermission();
            if (perm !== "granted") {{
                alert("Разрешение на уведомления не выдано");
                return;
            }}
        }}
        new Notification("Тестовое напоминание", {{
            body: "Если ты видишь это, уведомления работают."
        }});
    }}
    </script>
    """
    return render_page("Настройки", "", body)

@app.post("/settings")
def save_settings_route(
    remind_days_before: int = Form(3),
    remind_time_1: str = Form("09:00"),
    remind_time_2: str = Form("18:00"),
    notify_due_day: str | None = Form(None),
    notify_month_end: str | None = Form(None),
    browser_notifications: str | None = Form(None)
):
    settings["remind_days_before"] = remind_days_before
    settings["remind_time_1"] = remind_time_1
    settings["remind_time_2"] = remind_time_2
    settings["notify_due_day"] = notify_due_day is not None
    settings["notify_month_end"] = notify_month_end is not None
    settings["browser_notifications"] = browser_notifications is not None
    save_settings()
    return RedirectResponse(url="/settings", status_code=status.HTTP_303_SEE_OTHER)

@app.get("/edit/{payment_id}", response_class=HTMLResponse)
def edit_payment_page(payment_id: int, user: str = Depends(check_auth)):
    p = find_payment(payment_id)
    if not p:
        return "<h1>Платеж не найден</h1>"
    body = f"""
    <h1>Корректировка платежа</h1><p>Пользователь: {user}</p>
    <form action="/edit/{p['id']}" method="post">
        <label for="bank_name">Наименование банка</label><input id="bank_name" type="text" name="bank_name" value="{html.escape(p['bank_name'])}" required>
        <label for="amount">Общая сумма платежа</label><input id="amount" type="number" step="0.01" name="amount" value="{p['amount']}" required>
        <label for="paid_amount">Уже оплачено</label><input id="paid_amount" type="number" step="0.01" name="paid_amount" value="{p['paid_amount']}" required>
        <label for="currency">Валюта</label>
        <select id="currency" name="currency">
            <option value="RUB" {"selected" if p["currency"] == "RUB" else ""}>RUB — рубль</option>
            <option value="USD" {"selected" if p["currency"] == "USD" else ""}>USD — доллар</option>
            <option value="EUR" {"selected" if p["currency"] == "EUR" else ""}>EUR — евро</option>
        </select>
        <label for="pay_date">Дата платежа</label><input id="pay_date" type="date" name="pay_date" value="{p['pay_date']}" required>
        <label for="comment">Комментарий</label><input id="comment" type="text" name="comment" value="{html.escape(p['comment'])}">
        <button type="submit">Сохранить</button>
    </form>
    """
    return render_page("Корректировка", "", body)

@app.post("/edit/{payment_id}")
def edit_payment(
    payment_id: int,
    bank_name: str = Form(...),
    amount: float = Form(...),
    paid_amount: float = Form(...),
    currency: str = Form("RUB"),
    pay_date: str = Form(...),
    comment: str = Form("")
):
    p = find_payment(payment_id)
    if not p:
        raise HTTPException(status_code=404, detail="Платеж не найден")
    p["bank_name"] = bank_name
    p["amount"] = amount
    p["paid_amount"] = paid_amount
    p["currency"] = currency
    p["pay_date"] = pay_date
    p["comment"] = comment
    save_payments()
    return RedirectResponse(url="/payments", status_code=status.HTTP_303_SEE_OTHER)