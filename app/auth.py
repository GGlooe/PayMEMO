import hashlib
import secrets
import json
from pathlib import Path
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, Request, status, Header, Form
from fastapi.security import HTTPBasic, HTTPBasicCredentials

security = HTTPBasic(auto_error=False)

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

AUTH_FILE = DATA_DIR / "auth.json"
SESSION_SECRET_FILE = DATA_DIR / ".session_secret"
SESSIONS_FILE = DATA_DIR / "sessions.json"

USERNAME = "admin"


def _load_json(path, default):
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return default
    return default


def _save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _get_or_create_secret():
    if SESSION_SECRET_FILE.exists():
        return SESSION_SECRET_FILE.read_text().strip()
    secret = secrets.token_urlsafe(32)
    SESSION_SECRET_FILE.write_text(secret)
    return secret


SESSION_SECRET = _get_or_create_secret()


def _init_auth():
    if not AUTH_FILE.exists():
        salt = secrets.token_hex(16)
        pwd_hash = hashlib.scrypt(b"1234", salt=salt.encode(), n=2**14, r=8, p=1, dklen=32).hex()
        _save_json(AUTH_FILE, {"salt": salt, "hash": pwd_hash})


_init_auth()


def _get_auth_data():
    return _load_json(AUTH_FILE, {})


def _get_sessions():
    data = _load_json(SESSIONS_FILE, [])
    if not isinstance(data, list):
        data = []
    return data


def _save_sessions(data):
    _save_json(SESSIONS_FILE, data)


def change_password(new_password: str):
    salt = secrets.token_hex(16)
    pwd_hash = hashlib.scrypt(new_password.encode(), salt=salt.encode(), n=2**14, r=8, p=1, dklen=32).hex()
    _save_json(AUTH_FILE, {"salt": salt, "hash": pwd_hash})
    _save_sessions([])


def verify_credentials(username: str, password: str) -> bool:
    if not secrets.compare_digest(username, USERNAME):
        return False
    auth_data = _get_auth_data()
    salt = auth_data.get("salt", "")
    expected_hash = auth_data.get("hash", "")
    if not salt or not expected_hash:
        return False
    try:
        pwd_hash = hashlib.scrypt(password.encode(), salt=salt.encode(), n=2**14, r=8, p=1, dklen=32).hex()
    except Exception:
        return False
    return secrets.compare_digest(pwd_hash, expected_hash)


def create_session():
    session_id = secrets.token_urlsafe(32)
    csrf_token = secrets.token_urlsafe(32)
    sessions = _get_sessions()
    sessions.append({
        "id": session_id,
        "csrf": csrf_token,
        "created": datetime.now().isoformat()
    })
    cutoff = datetime.now() - timedelta(days=30)
    sessions = [s for s in sessions if datetime.fromisoformat(s["created"]) > cutoff]
    _save_sessions(sessions)
    return session_id, csrf_token


def delete_session(session_id: str):
    sessions = _get_sessions()
    sessions = [s for s in sessions if not secrets.compare_digest(s["id"], session_id)]
    _save_sessions(sessions)


def get_session(request: Request):
    session_id = request.cookies.get("session_id")
    if not session_id:
        return None
    sessions = _get_sessions()
    for s in sessions:
        if secrets.compare_digest(s["id"], session_id):
            return s
    return None


def check_auth(
    request: Request,
    credentials: HTTPBasicCredentials | None = Depends(security),
):
    session = get_session(request)
    if session:
        return USERNAME

    if credentials and verify_credentials(credentials.username, credentials.password):
        return credentials.username

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Basic"},
    )


def get_csrf_token(request: Request) -> str:
    session = get_session(request)
    if session:
        return session.get("csrf", "")
    return ""


async def require_csrf(
    request: Request,
    csrf_token: str = Form(""),
    x_csrf_token: str = Header(""),
):
    session = get_session(request)
    if not session:
        raise HTTPException(status_code=403, detail="CSRF check failed: no session")

    token = x_csrf_token or csrf_token
    if not token or not secrets.compare_digest(token, session.get("csrf", "")):
        raise HTTPException(status_code=403, detail="Invalid CSRF token")

    return True