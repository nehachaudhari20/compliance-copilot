"""Email and password accounts for the web app (JWT bearer sessions)."""
import base64
import hashlib
import hmac
import json
import os
import time
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import text

from .product import ROLES

USER_SCHEMA = [
    '''CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    organization TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL)''',
]

TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30
PBKDF2_ITERATIONS = 390_000


def _normalize_email(value: str) -> str:
    email = value.strip().lower()
    local, _, domain = email.partition('@')
    if not local or not domain or '.' not in domain:
        raise ValueError('Enter a valid email address')
    return email


class SignUpRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=200)
    name: str = Field(min_length=1, max_length=100)
    role: str
    organization: str = Field(min_length=1, max_length=200)

    @field_validator('email')
    @classmethod
    def valid_email(cls, value: str):
        return _normalize_email(value)

    @field_validator('role')
    @classmethod
    def known_role(cls, value: str):
        if value not in ROLES:
            raise ValueError('Select a role')
        return value


class SignInRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=200)

    @field_validator('email')
    @classmethod
    def valid_email(cls, value: str):
        return _normalize_email(value)


def ensure_users_table(store):
    with store.engine.begin() as conn:
        for statement in USER_SCHEMA:
            conn.execute(text(statement))


def _jwt_secret():
    secret = os.getenv('COPILOT_JWT_SECRET')
    if secret:
        return secret.encode()
    if os.getenv('VERCEL') or os.getenv('VERCEL_ENV'):
        raise RuntimeError('Set COPILOT_JWT_SECRET for account sign-in in production')
    return b'compliance-copilot-dev-only-change-me'


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip('=')


def _b64url_json(value: dict) -> str:
    return _b64url(json.dumps(value, separators=(',', ':'), sort_keys=True).encode())


def issue_session_token(user_id: str, organization: str, is_admin: bool) -> str:
    header = _b64url_json({'alg': 'HS256', 'typ': 'JWT'})
    payload = _b64url_json({
        'sub': user_id,
        'org': organization,
        'adm': bool(is_admin),
        'exp': int(time.time()) + TOKEN_TTL_SECONDS,
    })
    signing_input = f'{header}.{payload}'.encode()
    signature = _b64url(hmac.new(_jwt_secret(), signing_input, hashlib.sha256).digest())
    return f'{header}.{payload}.{signature}'


def session_from_token(token: str):
    try:
        header_b64, payload_b64, signature_b64 = token.split('.')
    except ValueError:
        return None
    signing_input = f'{header_b64}.{payload_b64}'.encode()
    expected = hmac.new(_jwt_secret(), signing_input, hashlib.sha256).digest()
    pad = '=' * (-len(signature_b64) % 4)
    try:
        provided = base64.urlsafe_b64decode(signature_b64 + pad)
    except ValueError:
        return None
    if not hmac.compare_digest(expected, provided):
        return None
    pad = '=' * (-len(payload_b64) % 4)
    try:
        payload = json.loads(base64.urlsafe_b64decode(payload_b64 + pad))
    except (ValueError, json.JSONDecodeError):
        return None
    if payload.get('exp', 0) < time.time():
        return None
    org = payload.get('org')
    user_id = payload.get('sub')
    if not isinstance(org, str) or not isinstance(user_id, str):
        return None
    return org, bool(payload.get('adm')), user_id


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, PBKDF2_ITERATIONS)
    return f'pbkdf2_sha256${PBKDF2_ITERATIONS}${_b64url(salt)}${_b64url(digest)}'


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, iterations, salt_b64, digest_b64 = stored.split('$', 3)
        if scheme != 'pbkdf2_sha256':
            return False
        salt = base64.urlsafe_b64decode(salt_b64 + '=' * (-len(salt_b64) % 4))
        expected = base64.urlsafe_b64decode(digest_b64 + '=' * (-len(digest_b64) % 4))
    except (ValueError, TypeError):
        return False
    derived = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, int(iterations))
    return hmac.compare_digest(expected, derived)


def resolve_bearer(token: str, token_config_fn):
    if not token:
        return None
    org_tokens, admin_tokens = token_config_fn()
    for tokens, is_admin in ((admin_tokens, True), (org_tokens, False)):
        for org, expected in tokens.items():
            if expected and hmac.compare_digest(token, expected):
                return org, is_admin, None
    session = session_from_token(token)
    if session:
        return session
    return None


def _session_response(user_row, token: str):
    return {
        'token': token,
        'organization': user_row['organization'],
        'is_admin': bool(user_row['is_admin']),
        'name': user_row['name'],
        'role': user_row['role'],
        'roles': ROLES,
    }


def install(app):
    ensure_users_table(app.state.store)
    router = APIRouter(prefix='/api/auth', tags=['auth'])

    @router.post('/signup', status_code=201)
    def signup(body: SignUpRequest):
        store = app.state.store
        email = body.email.strip().lower()
        organization = body.organization.strip()
        name = body.name.strip()
        with store.engine.begin() as conn:
            if conn.execute(text('SELECT 1 FROM users WHERE email = :email'), {'email': email}).first():
                raise HTTPException(409, 'An account with this email already exists')
            is_admin = conn.execute(
                text('SELECT COUNT(*) FROM users WHERE organization = :organization'),
                {'organization': organization},
            ).scalar() == 0
            user_id = str(uuid.uuid4())
            conn.execute(
                text('''INSERT INTO users (id, email, password_hash, name, role, organization, is_admin, created_at)
                        VALUES (:id, :email, :password_hash, :name, :role, :organization, :is_admin, :created_at)'''),
                {
                    'id': user_id,
                    'email': email,
                    'password_hash': hash_password(body.password),
                    'name': name,
                    'role': body.role,
                    'organization': organization,
                    'is_admin': int(is_admin),
                    'created_at': datetime.now(timezone.utc).isoformat(),
                },
            )
            row = {
                'organization': organization,
                'is_admin': is_admin,
                'name': name,
                'role': body.role,
            }
        token = issue_session_token(user_id, organization, is_admin)
        return _session_response(row, token)

    @router.post('/login')
    def login(body: SignInRequest):
        store = app.state.store
        email = body.email.strip().lower()
        with store.engine.connect() as conn:
            row = conn.execute(
                text('SELECT id, email, password_hash, name, role, organization, is_admin FROM users WHERE email = :email'),
                {'email': email},
            ).mappings().first()
        if not row or not verify_password(body.password, row['password_hash']):
            raise HTTPException(401, 'Invalid email or password')
        token = issue_session_token(row['id'], row['organization'], bool(row['is_admin']))
        return _session_response(row, token)

    app.include_router(router)
