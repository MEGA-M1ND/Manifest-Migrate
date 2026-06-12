"""Manifest backend regression tests (Phase 1 + Phase 2).

Phase 1: meta, auth (signup/login/me/duplicate/wrong-pw/no-token),
         usage bump, payments checkout, payments status, webhook bad-sig,
         account delete.

Phase 2 (new): email verification flow, resend-verification, forgot/reset
         password flow, admin stats + users, admin gating, signup auto-flags
         seeded admin email, signup does not 500 even when Resend send fails.
"""
import os
import uuid
import requests
import pytest
from pymongo import MongoClient

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL", "https://manifest-migrate.preview.emergentagent.com"
).rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

mongo = MongoClient(MONGO_URL)
db = mongo[DB_NAME]


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
    r = session.post(
        f"{API}/auth/signup",
        json={"email": email, "password": pw, "name": "TEST User"},
    )
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
        assert u["email_verified"] is False  # phase 2: unverified by default
        assert u["is_admin"] is False
        assert u["usage_migrations_run"] == 0

    def test_signup_duplicate_returns_409(self, session, new_user):
        r = session.post(
            f"{API}/auth/signup",
            json={"email": new_user["email"], "password": new_user["password"]},
        )
        assert r.status_code == 409

    def test_login_success(self, session, new_user):
        r = session.post(
            f"{API}/auth/login",
            json={"email": new_user["email"], "password": new_user["password"]},
        )
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["email"] == new_user["email"]
        assert d["token"]

    def test_login_wrong_password(self, session, new_user):
        r = session.post(
            f"{API}/auth/login",
            json={"email": new_user["email"], "password": "wrongpw1234"},
        )
        assert r.status_code == 401

    def test_me_with_token(self, session, new_user):
        r = session.get(
            f"{API}/auth/me", headers={"Authorization": f"Bearer {new_user['token']}"}
        )
        assert r.status_code == 200
        u = r.json()["user"]
        assert u["email"] == new_user["email"]
        assert u["email_verified"] is False  # still unverified

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
        me = session.get(
            f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}
        ).json()["user"]
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
        assert "status" in d and "payment_status" in d

    def test_webhook_bad_signature(self, session):
        r = requests.post(
            f"{API}/webhook/stripe",
            data=b'{"id":"evt_test"}',
            headers={"Stripe-Signature": "t=0,v1=invalid", "Content-Type": "application/json"},
        )
        assert r.status_code == 400


# ---------------- phase 2: email verification ----------------
class TestEmailVerification:
    def test_signup_inserts_verify_token(self, new_user):
        # Mongo should have a kind='verify' token for this new user
        tok = db.email_tokens.find_one(
            {"user_id": new_user["user"]["user_id"], "kind": "verify"}
        )
        assert tok, "expected a verify token in Mongo after signup"
        assert tok.get("used") is False

    def test_verify_email_invalid_token(self, session):
        r = session.post(f"{API}/auth/verify-email", json={"token": "definitely-not-real"})
        assert r.status_code == 400

    def test_verify_email_success_and_me_flips(self, session, new_user):
        tok = db.email_tokens.find_one(
            {"user_id": new_user["user"]["user_id"], "kind": "verify", "used": False}
        )
        assert tok, "no unused verify token"
        r = session.post(f"{API}/auth/verify-email", json={"token": tok["token"]})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True

        # /me should now report email_verified=true
        me = session.get(
            f"{API}/auth/me",
            headers={"Authorization": f"Bearer {new_user['token']}"},
        ).json()["user"]
        assert me["email_verified"] is True

    def test_verify_email_reuse_rejected(self, session, new_user):
        # The previous test consumed the token; trying again must fail
        tok = db.email_tokens.find_one(
            {"user_id": new_user["user"]["user_id"], "kind": "verify", "used": True}
        )
        assert tok
        r = session.post(f"{API}/auth/verify-email", json={"token": tok["token"]})
        assert r.status_code == 400

    def test_resend_verification_already_verified(self, session, new_user):
        # user is now verified, should return already_verified=true
        r = session.post(
            f"{API}/auth/resend-verification",
            json={},
            headers={"Authorization": f"Bearer {new_user['token']}"},
        )
        assert r.status_code == 200
        assert r.json().get("already_verified") is True

    def test_resend_verification_unauth(self, session):
        r = session.post(f"{API}/auth/resend-verification", json={})
        assert r.status_code in (401, 403)

    def test_resend_verification_inserts_new_token_for_unverified(self, session):
        # Create a fresh user, immediately resend
        email = _rand_email()
        pw = "TesterPass!23"
        signup = session.post(
            f"{API}/auth/signup",
            json={"email": email, "password": pw, "name": "Resend Test"},
        )
        assert signup.status_code == 200
        token = signup.json()["token"]
        uid = signup.json()["user"]["user_id"]
        before = db.email_tokens.count_documents({"user_id": uid, "kind": "verify"})
        r = session.post(
            f"{API}/auth/resend-verification",
            json={},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 200
        assert r.json().get("ok") is True
        after = db.email_tokens.count_documents({"user_id": uid, "kind": "verify"})
        assert after == before + 1


# ---------------- phase 2: forgot / reset password ----------------
class TestPasswordReset:
    def test_forgot_password_unknown_email_returns_ok(self, session):
        r = session.post(
            f"{API}/auth/forgot-password",
            json={"email": _rand_email("NOPE_")},
        )
        # anti-enumeration: always ok
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_forgot_password_known_inserts_token(self, session, new_user):
        before = db.email_tokens.count_documents(
            {"user_id": new_user["user"]["user_id"], "kind": "reset"}
        )
        r = session.post(
            f"{API}/auth/forgot-password", json={"email": new_user["email"]}
        )
        assert r.status_code == 200
        assert r.json().get("ok") is True
        after = db.email_tokens.count_documents(
            {"user_id": new_user["user"]["user_id"], "kind": "reset"}
        )
        assert after == before + 1

    def test_reset_password_invalid_token(self, session):
        r = session.post(
            f"{API}/auth/reset-password",
            json={"token": "bogus-reset-token", "password": "NewPass!2345"},
        )
        assert r.status_code == 400

    def test_reset_password_success_then_login_with_new_pw(self, session, new_user):
        tok = db.email_tokens.find_one(
            {"user_id": new_user["user"]["user_id"], "kind": "reset", "used": False}
        )
        assert tok, "no unused reset token"
        new_pw = "BrandNewPass!99"
        r = session.post(
            f"{API}/auth/reset-password",
            json={"token": tok["token"], "password": new_pw},
        )
        assert r.status_code == 200, r.text

        # old password should now fail
        old_login = session.post(
            f"{API}/auth/login",
            json={"email": new_user["email"], "password": new_user["password"]},
        )
        assert old_login.status_code == 401

        # new password should succeed
        new_login = session.post(
            f"{API}/auth/login",
            json={"email": new_user["email"], "password": new_pw},
        )
        assert new_login.status_code == 200

        # token cannot be re-used
        r2 = session.post(
            f"{API}/auth/reset-password",
            json={"token": tok["token"], "password": "AnotherPass!1"},
        )
        assert r2.status_code == 400

        # update fixture so cleanup still works
        new_user["password"] = new_pw
        new_user["token"] = new_login.json()["token"]


# ---------------- phase 2: admin ----------------
class TestAdmin:
    @pytest.fixture(scope="class")
    def admin_token(self, session):
        email = "vpkarthik97@gmail.com"
        pw = "ManifestAdmin!23"
        r = session.post(f"{API}/auth/login", json={"email": email, "password": pw})
        if r.status_code != 200:
            # try signup (auto-flags is_admin per ADMIN_EMAIL)
            r = session.post(
                f"{API}/auth/signup",
                json={"email": email, "password": pw, "name": "Admin"},
            )
            if r.status_code not in (200, 409):
                pytest.skip(f"cannot create admin user: {r.status_code} {r.text}")
            if r.status_code == 409:
                # account exists but password wrong → can't continue
                pytest.skip("admin account exists but password mismatch")
        return r.json()["token"]

    def test_admin_flag_set_on_seeded_email(self, session, admin_token):
        r = session.get(
            f"{API}/auth/me", headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert r.status_code == 200
        u = r.json()["user"]
        assert u["is_admin"] is True, f"is_admin should be true for {u['email']}"

    def test_stats_non_admin_403(self, session, new_user):
        r = session.get(
            f"{API}/admin/stats",
            headers={"Authorization": f"Bearer {new_user['token']}"},
        )
        assert r.status_code == 403

    def test_stats_admin_success(self, session, admin_token):
        r = session.get(
            f"{API}/admin/stats", headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert set(d["users"].keys()) >= {"total", "free", "paid"}
        assert d["users"]["total"] == d["users"]["free"] + d["users"]["paid"]
        assert "total_usd" in d["revenue"] and "count" in d["revenue"]
        assert isinstance(d["signups_30d"], list) and len(d["signups_30d"]) == 30
        for row in d["signups_30d"]:
            assert {"day", "signups", "paid"} <= set(row.keys())
        assert isinstance(d["recent_payments"], list)
        assert len(d["recent_payments"]) <= 10

    def test_users_non_admin_403(self, session, new_user):
        r = session.get(
            f"{API}/admin/users",
            headers={"Authorization": f"Bearer {new_user['token']}"},
        )
        assert r.status_code == 403

    def test_users_admin_success_no_password_hash(self, session, admin_token):
        r = session.get(
            f"{API}/admin/users", headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and "count" in d
        assert d["count"] == len(d["items"])
        assert len(d["items"]) <= 100
        for u in d["items"]:
            assert "password_hash" not in u
            assert "_id" not in u


# ---------------- phase 2: signup never 500 even if Resend sandbox rejects ----------------
class TestSignupResilience:
    def test_signup_never_500s(self, session):
        # Use a random non-resend-owner email; sandbox send will likely log+swallow
        for _ in range(2):
            email = _rand_email()
            r = session.post(
                f"{API}/auth/signup",
                json={"email": email, "password": "TesterPass!23", "name": "ResilCheck"},
            )
            assert r.status_code == 200, f"signup returned {r.status_code}: {r.text}"

    def test_forgot_password_never_500s(self, session, new_user):
        r = session.post(
            f"{API}/auth/forgot-password", json={"email": new_user["email"]}
        )
        assert r.status_code == 200


# ---------------- cleanup (delete account) ----------------
class TestAccountDelete:
    def test_delete_account(self, session, new_user):
        token = new_user["token"]
        r = session.delete(
            f"{API}/auth/account", headers={"Authorization": f"Bearer {token}"}
        )
        assert r.status_code == 200
        r2 = session.get(
            f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}
        )
        assert r2.status_code == 401
