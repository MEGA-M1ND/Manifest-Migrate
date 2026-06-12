"""Resend transactional email helpers for Manifest.

Sandbox note: with onboarding@resend.dev as the sender, Resend only delivers to
the verified account-owner email. To send to anyone, verify a custom domain in
Resend and change SENDER_EMAIL.
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Optional

import resend

logger = logging.getLogger("manifest.email")

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "Manifest <onboarding@resend.dev>")

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


def _shell(title: str, preview: str, body_html: str) -> str:
    """Email shell with inline CSS — same cargo-manifest aesthetic, email-safe."""
    return f"""<!doctype html><html><head><meta charset="utf-8"><title>{title}</title></head>
<body style="margin:0;padding:0;background:#E9EDF1;font-family:Inter,Arial,sans-serif;color:#14213D;">
<span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;">{preview}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E9EDF1;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #14213D;box-shadow:4px 4px 0 0 #14213D;">
      <tr><td style="padding:24px 28px 0 28px;">
        <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#E8590C;font-weight:600;">Manifest · M·001</div>
        <div style="font-family:Georgia,'Space Grotesk',serif;font-weight:700;font-size:24px;margin-top:6px;line-height:1.15;">{title}</div>
      </td></tr>
      <tr><td style="padding:18px 28px 28px 28px;font-size:15px;line-height:1.55;">{body_html}</td></tr>
      <tr><td style="padding:18px 28px;border-top:1px solid #C8D1DA;font-family:'Courier New',monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#4A5568;">
        Manifest · Migration Manifest No. 001 · <a href="mailto:hello@manifest.app" style="color:#4A5568;text-decoration:underline;">hello@manifest.app</a>
      </td></tr>
    </table>
    <div style="font-family:'Courier New',monospace;font-size:11px;color:#4A5568;margin-top:18px;">Your conversation data never leaves your browser.</div>
  </td></tr>
</table></body></html>"""


def _button(href: str, label: str) -> str:
    return (
        f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;">'
        f'<tr><td style="background:#14213D;border:1px solid #14213D;box-shadow:2px 2px 0 0 #14213D;">'
        f'<a href="{href}" style="display:inline-block;padding:12px 22px;color:#ffffff;text-decoration:none;'
        f"font-family:'Courier New',monospace;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;\">"
        f'{label}</a></td></tr></table>'
    )


def render_verification_email(name: str, verify_url: str) -> tuple[str, str]:
    subject = "Verify your Manifest account"
    body = (
        f"<p>Hi {name or 'there'},</p>"
        "<p>Thanks for signing up to Manifest. Click the button below to verify your email "
        "and remove the reminder banner from your account.</p>"
        + _button(verify_url, "Verify email")
        + f'<p style="font-size:13px;color:#4A5568;">Or paste this link into your browser:<br>'
          f'<a href="{verify_url}" style="color:#E8590C;word-break:break-all;">{verify_url}</a></p>'
        "<p style=\"font-size:13px;color:#4A5568;\">If you didn't sign up, you can ignore this email.</p>"
    )
    return subject, _shell(subject, "Confirm your Manifest email — one click.", body)


def render_password_reset_email(name: str, reset_url: str) -> tuple[str, str]:
    subject = "Reset your Manifest password"
    body = (
        f"<p>Hi {name or 'there'},</p>"
        "<p>We received a request to reset your Manifest password. Click below to set a new one. "
        "This link expires in 1 hour.</p>"
        + _button(reset_url, "Set a new password")
        + f'<p style="font-size:13px;color:#4A5568;">Or paste this link into your browser:<br>'
          f'<a href="{reset_url}" style="color:#E8590C;word-break:break-all;">{reset_url}</a></p>'
        "<p style=\"font-size:13px;color:#4A5568;\">Didn't request this? You can safely ignore the email — your password stays the same.</p>"
    )
    return subject, _shell(subject, "One-hour password reset link inside.", body)


def render_purchase_email(name: str, amount: float, currency: str, session_id: str) -> tuple[str, str]:
    subject = "Your Manifest Full version is unlocked"
    body = (
        f"<p>Hi {name or 'there'},</p>"
        "<p>Thank you for upgrading to <strong>Manifest Full</strong>. Your account is now "
        "lifetime-unlimited: pack any number of conversations, across any number of projects, "
        "with custom-instruction extraction enabled.</p>"
        f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;width:100%;border:1px solid #C8D1DA;">'
        f'<tr><td style="padding:14px 16px;background:#E9EDF1;font-family:\'Courier New\',monospace;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#14213D;">Receipt</td></tr>'
        f'<tr><td style="padding:14px 16px;font-size:14px;">'
        f"Plan: <strong>Manifest Full · Lifetime</strong><br>"
        f"Amount: <strong>${amount:.2f} {currency.upper()}</strong><br>"
        f"Reference: <code style=\"font-family:'Courier New',monospace;font-size:12px;color:#4A5568;\">{session_id}</code>"
        f"</td></tr></table>"
        "<p>You can grab a Stripe-hosted invoice from your billing email; full payment history "
        "is visible at <a href=\"https://manifest-migrate.preview.emergentagent.com/account\" style=\"color:#E8590C;\">your account page</a>.</p>"
        "<p style=\"font-size:13px;color:#4A5568;\">Refund within 7 days, no questions — just reply to this email.</p>"
    )
    return subject, _shell(subject, "Receipt + lifetime access confirmation.", body)


async def send_email(to: str, subject: str, html: str) -> Optional[str]:
    """Send and never raise — email failures shouldn't 500 the calling endpoint."""
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set; skipping email to %s (%s)", to, subject)
        return None
    params = {"from": SENDER_EMAIL, "to": [to], "subject": subject, "html": html}
    try:
        res = await asyncio.to_thread(resend.Emails.send, params)
        eid = res.get("id") if isinstance(res, dict) else None
        logger.info("resend → %s id=%s subject=%s", to, eid, subject)
        return eid
    except Exception as e:  # noqa: BLE001
        logger.exception("resend send failed to=%s subject=%s: %s", to, subject, e)
        return None
