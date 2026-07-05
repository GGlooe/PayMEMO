import hashlib
import secrets

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials

security = HTTPBasic(auto_error=False)

USERNAME = "admin"
PASSWORD = "1234"
AUTH_COOKIE_NAME = "auth"
AUTH_TOKEN = hashlib.sha256(f"{USERNAME}:{PASSWORD}".encode()).hexdigest()


def verify_credentials(username: str, password: str) -> bool:
    user_ok = secrets.compare_digest(username, USERNAME)
    pass_ok = secrets.compare_digest(password, PASSWORD)
    return user_ok and pass_ok


def check_auth(
    request: Request,
    credentials: HTTPBasicCredentials | None = Depends(security),
):
    cookie = request.cookies.get(AUTH_COOKIE_NAME)
    if cookie and secrets.compare_digest(cookie, AUTH_TOKEN):
        return USERNAME

    if credentials and verify_credentials(credentials.username, credentials.password):
        return credentials.username

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Basic"},
    )
