"""Manifest backend regression tests.

Covers:
- meta (GET /api/)
- auth signup/login/me/account-delete
- usage bump
- payments checkout + status
- webhook signature rejection
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://manifest-migrate.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _rand_email(prefix="TEST_"):
    return f"{prefix}{uuid.uuid4().hex[:10]}@manifestqa.io".lower()


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def new_user(session):
    email = _rand_email()
    pw = "TesterPass!23"
    r = session.post(f"{API}/auth/signup", json={"email": email, "password": pw, "name": "TEST User"})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"email": email, "password": pw, "token": data["token"], "user": data["user"]}


# ---------------- meta ----------------
class TestMeta:
    def test_root_meta(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        d = r.json()
        assert d["name"] == "manifest"
        assert d["limits"]["free_convos"] == 20
        assert d["limits"]["free_projects"] == 1
        assert d["limits"]["full_price_usd"] == 9.0


# ---------------- auth ----------------
class TestAuth:
    def test_signup_returns_token_and_user(self, new_user):
        assert new_user["token"]
        u = new_user["user"]
        assert u["email"] == new_user["email"]
        assert u["plan"] == "free"
        assert u["usage_migrations_run"] == 0
        assert u["usage_conversations_packed"] == 0

    def test_signup_duplicate_returns_409(self, session, new_user):
        r = session.post(f"{API}/auth/signup", json={"email": new_user["email"], "password": new_user["password"]})
        assert r.status_code == 409

    def test_login_success(self, session, new_user):
        r = session.post(f"{API}/auth/login", json={"email": new_user["email"], "password": new_user["password"]})
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["email"] == new_user["email"]
        assert d["token"]

    def test_login_wrong_password(self, session, new_user):
        r = session.post(f"{API}/auth/login", json={"email": new_user["email"], "password": "wrongpw1234"})
        assert r.status_code == 401

    def test_me_with_token(self, session, new_user):
        r = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {new_user['token']}"})
        assert r.status_code == 200
        assert r.json()["user"]["email"] == new_user["email"]

    def test_me_without_token(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code in (401, 403)


# ---------------- usage ----------------
class TestUsage:
    def test_usage_bump_increments(self, session, new_user):
        token = new_user["token"]
        r = session.post(
            f"{API}/usage/bump",
            json={"conversations": 3, "projects": 1},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 200
        # Verify via /me
        me = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}).json()["user"]
        assert me["usage_migrations_run"] >= 1
        assert me["usage_conversations_packed"] >= 3

    def test_usage_bump_unauth(self, session):
        r = session.post(f"{API}/usage/bump", json={"conversations": 1, "projects": 1})
        assert r.status_code in (401, 403)


# ---------------- payments ----------------
class TestPayments:
    def test_checkout_creates_session(self, session, new_user):
        token = new_user["token"]
        r = session.post(
            f"{API}/payments/checkout",
            json={"origin_url": BASE_URL},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["url"].startswith("https://")
        assert d["session_id"]
        pytest.session_id = d["session_id"]

    def test_checkout_status_no_crash(self, session, new_user):
        sid = getattr(pytest, "session_id", None)
        assert sid, "no session_id from previous test"
        r = session.get(
            f"{API}/payments/status/{sid}",
            headers={"Authorization": f"Bearer {new_user['token']}"},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        # status is typically 'open', payment_status 'unpaid'
        assert "status" in d
        assert "payment_status" in d

    def test_webhook_bad_signature(self, session):
        r = requests.post(
            f"{API}/webhook/stripe",
            data=b'{"id":"evt_test"}',
            headers={"Stripe-Signature": "t=0,v1=invalid", "Content-Type": "application/json"},
        )
        assert r.status_code == 400


# ---------------- cleanup (delete account) ----------------
class TestAccountDelete:
    def test_delete_account(self, session, new_user):
        token = new_user["token"]
        r = session.delete(f"{API}/auth/account", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        # me should now 401
        r2 = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r2.status_code == 401
