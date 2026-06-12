"""Manifest — backend.

FastAPI server for Manifest: a privacy-first ChatGPT-to-Claude migration SaaS.

Conversation data NEVER touches this server. We only handle:
- Accounts (email/password + Emergent Google OAuth)
- Entitlements (free / full)
- Stripe one-time $9 lifetime upgrade
- Anonymous usage counters (numeric only)
"""
from __future__ import annotations

import os
import uuid
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional, Annotated

import bcrypt
import httpx
import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Cookie, Depends, FastAPI, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from starlette.middleware.cors import CORSMiddleware

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionRequest,
)

from emails import (
    render_password_reset_email,
    render_purchase_email,
    render_verification_email,
    send_email,
)


# ----------- bootstrap -----------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("manifest")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me-please")
JWT_ALG = "HS256"
JWT_TTL_DAYS = 14
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "sk_test_emergent")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "vpkarthik97@gmail.com").lower()
FRONTEND_URL = os.environ.get("FRONTEND_URL", "").rstrip("/")
VERIFICATION_TTL_HOURS = 72
RESET_TTL_HOURS = 1

PLAN_FREE = "free"
PLAN_FULL = "full"
FREE_MAX_CONVERSATIONS = 20
FREE_MAX_PROJECTS = 1
FULL_PLAN_PRICE_USD = 9.00

EMERGENT_AUTH_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Manifest API")
api = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)


# ----------- models -----------
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: EmailStr
    name: str = ""
    plan: str = PLAN_FREE
    plan_purchased_at: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    auth_provider: str = "password"  # password | google
    email_verified: bool = False
    is_admin: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    usage_migrations_run: int = 0
    usage_conversations_packed: int = 0
    last_used_at: Optional[str] = None


class SignupReq(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)
    name: str = ""


class LoginReq(BaseModel):
    email: EmailStr
    password: str


class GoogleCallbackReq(BaseModel):
    session_id: str


class UsageBumpReq(BaseModel):
    conversations: int = Field(ge=0, le=1_000_000)
    projects: int = Field(ge=0, le=10_000)


class CheckoutReq(BaseModel):
    origin_url: str


class VerifyEmailReq(BaseModel):
    token: str


class ResendVerificationReq(BaseModel):
    email: EmailStr


class ForgotPasswordReq(BaseModel):
    email: EmailStr


class ResetPasswordReq(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=200)


# ----------- helpers -----------
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def make_jwt(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": user_id, "iat": int(now.timestamp()), "exp": int((now + timedelta(days=JWT_TTL_DAYS)).timestamp())}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_user_by_id(user_id: str) -> Optional[dict]:
    return await db.users.find_one({"user_id": user_id}, {"_id": 0})


async def get_user_by_email(email: str) -> Optional[dict]:
    return await db.users.find_one({"email": email.lower()}, {"_id": 0})


def to_public_user(doc: dict) -> dict:
    keys = (
        "user_id email name plan plan_purchased_at auth_provider email_verified is_admin "
        "created_at usage_migrations_run usage_conversations_packed last_used_at"
    ).split()
    return {k: doc.get(k) for k in keys}


async def current_user(
    creds: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer)] = None,
    session_token: Annotated[Optional[str], Cookie()] = None,
) -> dict:
    token = None
    if creds and creds.credentials:
        token = creds.credentials
    elif session_token:
        token = session_token
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await get_user_by_id(payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_admin(user: dict = Depends(current_user)) -> dict:
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin only")
    return user


def _frontend_url(request: Request) -> str:
    if FRONTEND_URL:
        return FRONTEND_URL
    # Derive from request's Origin/Referer as best-effort fallback
    origin = request.headers.get("origin") or request.headers.get("referer") or ""
    return origin.rstrip("/")


def _new_token() -> str:
    return uuid.uuid4().hex + uuid.uuid4().hex


async def _issue_verification_email(user: dict, request: Request):
    if user.get("email_verified"):
        return
    token = _new_token()
    expires = datetime.now(timezone.utc) + timedelta(hours=VERIFICATION_TTL_HOURS)
    await db.email_tokens.insert_one(
        {
            "token": token,
            "user_id": user["user_id"],
            "kind": "verify",
            "expires_at": expires.isoformat(),
            "used": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    base = _frontend_url(request)
    verify_url = f"{base}/verify-email?token={token}"
    subject, html = render_verification_email(user.get("name") or "", verify_url)
    await send_email(user["email"], subject, html)


# ----------- auth endpoints -----------
@api.post("/auth/signup")
async def signup(req: SignupReq, request: Request):
    email = req.email.lower()
    if await get_user_by_email(email):
        raise HTTPException(status_code=409, detail="Account already exists")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user = User(
        user_id=user_id,
        email=email,
        name=req.name or email.split("@")[0],
        auth_provider="password",
        is_admin=(email == ADMIN_EMAIL),
    )
    doc = user.model_dump()
    doc["password_hash"] = hash_pw(req.password)
    await db.users.insert_one(doc)
    # fire-and-forget verification email
    await _issue_verification_email(doc, request)
    return {"token": make_jwt(user_id), "user": to_public_user(doc)}


@api.post("/auth/login")
async def login(req: LoginReq):
    user = await db.users.find_one({"email": req.email.lower()}, {"_id": 0})
    if not user or not user.get("password_hash") or not verify_pw(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"token": make_jwt(user["user_id"]), "user": to_public_user(user)}


@api.post("/auth/google/callback")
async def google_callback(req: GoogleCallbackReq):
    """Exchange Emergent session_id for our own JWT."""
    async with httpx.AsyncClient(timeout=15) as http:
        r = await http.get(EMERGENT_AUTH_SESSION_URL, headers={"X-Session-ID": req.session_id})
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Google session invalid")
    data = r.json()
    email = (data.get("email") or "").lower()
    if not email:
        raise HTTPException(status_code=401, detail="Google session missing email")
    existing = await get_user_by_email(email)
    if existing:
        # update name/picture if changed
        await db.users.update_one(
            {"user_id": existing["user_id"]},
            {"$set": {"name": data.get("name") or existing.get("name") or "", "email_verified": True}},
        )
        user_id = existing["user_id"]
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        new_user = User(
            user_id=user_id,
            email=email,
            name=data.get("name") or email.split("@")[0],
            auth_provider="google",
            email_verified=True,
            is_admin=(email == ADMIN_EMAIL),
        )
        await db.users.insert_one(new_user.model_dump())
    user = await get_user_by_id(user_id)
    return {"token": make_jwt(user_id), "user": to_public_user(user)}


@api.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    return {"user": to_public_user(user)}


@api.post("/auth/verify-email")
async def verify_email(req: VerifyEmailReq):
    tok = await db.email_tokens.find_one({"token": req.token, "kind": "verify"}, {"_id": 0})
    if not tok:
        raise HTTPException(status_code=400, detail="Invalid or already-used link")
    if tok.get("used"):
        raise HTTPException(status_code=400, detail="This link has already been used")
    if datetime.fromisoformat(tok["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="This link has expired — request a new one")
    await db.users.update_one({"user_id": tok["user_id"]}, {"$set": {"email_verified": True}})
    await db.email_tokens.update_one({"token": req.token}, {"$set": {"used": True}})
    user = await get_user_by_id(tok["user_id"])
    return {"ok": True, "user": to_public_user(user) if user else None}


@api.post("/auth/resend-verification")
async def resend_verification(request: Request, user: dict = Depends(current_user)):
    if user.get("email_verified"):
        return {"ok": True, "already_verified": True}
    await _issue_verification_email(user, request)
    return {"ok": True}


@api.post("/auth/forgot-password")
async def forgot_password(req: ForgotPasswordReq, request: Request):
    """Always return ok=true to avoid leaking which emails are registered."""
    user = await get_user_by_email(req.email)
    if user and user.get("auth_provider") == "password":
        token = _new_token()
        expires = datetime.now(timezone.utc) + timedelta(hours=RESET_TTL_HOURS)
        await db.email_tokens.insert_one(
            {
                "token": token,
                "user_id": user["user_id"],
                "kind": "reset",
                "expires_at": expires.isoformat(),
                "used": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        base = _frontend_url(request)
        reset_url = f"{base}/reset-password?token={token}"
        subject, html = render_password_reset_email(user.get("name") or "", reset_url)
        await send_email(user["email"], subject, html)
    return {"ok": True}


@api.post("/auth/reset-password")
async def reset_password(req: ResetPasswordReq):
    tok = await db.email_tokens.find_one({"token": req.token, "kind": "reset"}, {"_id": 0})
    if not tok or tok.get("used"):
        raise HTTPException(status_code=400, detail="Invalid or already-used link")
    if datetime.fromisoformat(tok["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="This link has expired — request a new one")
    await db.users.update_one(
        {"user_id": tok["user_id"]},
        {"$set": {"password_hash": hash_pw(req.password)}},
    )
    await db.email_tokens.update_one({"token": req.token}, {"$set": {"used": True}})
    return {"ok": True}


@api.delete("/auth/account")
async def delete_account(user: dict = Depends(current_user)):
    await db.users.delete_one({"user_id": user["user_id"]})
    await db.payment_transactions.delete_many({"user_id": user["user_id"]})
    return {"ok": True}


# ----------- usage (numeric only) -----------
@api.post("/usage/bump")
async def usage_bump(req: UsageBumpReq, user: dict = Depends(current_user)):
    """Anonymous counters — only numbers, NEVER content."""
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {
            "$inc": {
                "usage_migrations_run": 1,
                "usage_conversations_packed": int(req.conversations),
            },
            "$set": {"last_used_at": datetime.now(timezone.utc).isoformat()},
        },
    )
    return {"ok": True}


# ----------- stripe -----------
def _stripe_client(request: Request) -> StripeCheckout:
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    return StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)


@api.post("/payments/checkout")
async def create_checkout(req: CheckoutReq, request: Request, user: dict = Depends(current_user)):
    if user.get("plan") == PLAN_FULL:
        raise HTTPException(status_code=400, detail="Already on Full plan")
    origin = req.origin_url.rstrip("/")
    success_url = f"{origin}/app?upgraded=1&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/app?upgrade_cancelled=1"
    sc = _stripe_client(request)
    cr = CheckoutSessionRequest(
        amount=FULL_PLAN_PRICE_USD,
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": user["user_id"],
            "email": user["email"],
            "package": "full_plan_lifetime",
        },
    )
    session = await sc.create_checkout_session(cr)
    await db.payment_transactions.insert_one(
        {
            "txn_id": f"txn_{uuid.uuid4().hex[:12]}",
            "session_id": session.session_id,
            "user_id": user["user_id"],
            "email": user["email"],
            "amount": FULL_PLAN_PRICE_USD,
            "currency": "usd",
            "status": "initiated",
            "payment_status": "unpaid",
            "metadata": {"package": "full_plan_lifetime"},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    return {"url": session.url, "session_id": session.session_id}


async def _apply_paid(session_id: str, user_id: Optional[str]):
    """Idempotently upgrade the user tied to a paid session."""
    txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not txn:
        logger.warning("apply_paid: no txn for session %s", session_id)
        return
    if txn.get("payment_status") == "paid":
        return  # already processed
    target_user_id = user_id or txn.get("user_id")
    if not target_user_id:
        return
    now = datetime.now(timezone.utc).isoformat()
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {"status": "completed", "payment_status": "paid", "paid_at": now}},
    )
    await db.users.update_one(
        {"user_id": target_user_id},
        {"$set": {"plan": PLAN_FULL, "plan_purchased_at": now}},
    )
    # Purchase confirmation email — never crash _apply_paid if email fails
    try:
        user = await get_user_by_id(target_user_id)
        if user:
            subject, html = render_purchase_email(
                user.get("name") or "",
                float(txn.get("amount") or FULL_PLAN_PRICE_USD),
                txn.get("currency") or "usd",
                session_id,
            )
            await send_email(user["email"], subject, html)
    except Exception as e:  # noqa: BLE001
        logger.exception("purchase email failed for session %s: %s", session_id, e)


@api.get("/payments/status/{session_id}")
async def checkout_status(session_id: str, request: Request, user: dict = Depends(current_user)):
    sc = _stripe_client(request)
    status_resp = await sc.get_checkout_status(session_id)
    if status_resp.payment_status == "paid":
        await _apply_paid(session_id, user["user_id"])
    return {
        "status": status_resp.status,
        "payment_status": status_resp.payment_status,
        "amount_total": status_resp.amount_total,
        "currency": status_resp.currency,
    }


@api.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    sc = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
    try:
        evt = await sc.handle_webhook(body, sig)
    except Exception as e:
        logger.exception("webhook verification failed: %s", e)
        raise HTTPException(status_code=400, detail="invalid signature")
    if (evt.event_type or "").lower() in ("checkout.session.completed", "payment_intent.succeeded") and (
        (evt.payment_status or "").lower() == "paid"
    ):
        await _apply_paid(evt.session_id, (evt.metadata or {}).get("user_id"))
    return {"ok": True}


@api.get("/payments/history")
async def payment_history(user: dict = Depends(current_user)):
    items = await db.payment_transactions.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"items": items}


# ----------- admin -----------
@api.get("/admin/stats")
async def admin_stats(_: dict = Depends(require_admin)):
    total = await db.users.count_documents({})
    paid = await db.users.count_documents({"plan": PLAN_FULL})
    free = total - paid
    revenue_cur = db.payment_transactions.aggregate(
        [
            {"$match": {"payment_status": "paid"}},
            {"$group": {"_id": None, "sum": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        ]
    )
    rev = await revenue_cur.to_list(1)
    revenue = rev[0] if rev else {"sum": 0, "count": 0}

    # daily signups for the last 30 days
    cutoff = (datetime.now(timezone.utc) - timedelta(days=29)).isoformat()
    users = await db.users.find(
        {"created_at": {"$gte": cutoff}}, {"_id": 0, "created_at": 1, "plan": 1}
    ).to_list(5000)
    by_day: dict[str, dict] = {}
    for u in users:
        d = (u.get("created_at") or "")[:10]
        if not d:
            continue
        slot = by_day.setdefault(d, {"day": d, "signups": 0, "paid": 0})
        slot["signups"] += 1
        if u.get("plan") == PLAN_FULL:
            slot["paid"] += 1
    # fill in missing days
    series = []
    for i in range(30):
        d = (datetime.now(timezone.utc) - timedelta(days=29 - i)).date().isoformat()
        series.append(by_day.get(d, {"day": d, "signups": 0, "paid": 0}))

    recent_revenue = await db.payment_transactions.find(
        {"payment_status": "paid"}, {"_id": 0}
    ).sort("paid_at", -1).limit(10).to_list(10)

    return {
        "users": {"total": total, "free": free, "paid": paid},
        "revenue": {"total_usd": round(float(revenue.get("sum") or 0), 2), "count": revenue.get("count") or 0},
        "signups_30d": series,
        "recent_payments": recent_revenue,
    }


@api.get("/admin/users")
async def admin_users(_: dict = Depends(require_admin), limit: int = 100):
    items = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"items": items, "count": len(items)}


# ----------- meta -----------
@api.get("/")
async def root():
    return {"name": "manifest", "version": "1.0.0", "limits": {"free_convos": FREE_MAX_CONVERSATIONS, "free_projects": FREE_MAX_PROJECTS, "full_price_usd": FULL_PLAN_PRICE_USD}}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def _shutdown():
    client.close()
