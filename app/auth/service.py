import json
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import JWTError, jwt

from app.config import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRY_MINUTES, USERS_FILE


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def load_users() -> dict:
    try:
        with open(USERS_FILE, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"users": []}


def save_users(data: dict) -> None:
    with open(USERS_FILE, "w") as f:
        json.dump(data, f, indent=2)


def get_user(username: str) -> Optional[dict]:
    data = load_users()
    for user in data.get("users", []):
        if user["username"] == username:
            return user
    return None


def create_user(username: str, password: str) -> tuple[bool, str]:
    if len(username) < 3:
        return False, "Username must be at least 3 characters"
    if len(password) < 6:
        return False, "Password must be at least 6 characters"
    if get_user(username):
        return False, "Username already exists"

    data = load_users()
    data["users"].append({
        "username": username,
        "hashed_password": hash_password(password)
    })
    save_users(data)
    return True, "User created successfully"


def authenticate_user(username: str, password: str) -> Optional[dict]:
    user = get_user(username)
    if not user:
        return None
    if not verify_password(password, user["hashed_password"]):
        return None
    return user


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRY_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None
