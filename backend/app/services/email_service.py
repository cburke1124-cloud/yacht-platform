import logging
import os
from pathlib import Path

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from dotenv import load_dotenv, find_dotenv
from jinja2 import Environment, FileSystemLoader, select_autoescape

# Templates live next to this file in email_templates/
_TEMPLATE_DIR = Path(__file__).parent / "email_templates"


class EmailService:
    def __init__(self):
        load_dotenv(find_dotenv(), override=False)

        raw_api_key = os.getenv("SENDGRID_API_KEY")
        if raw_api_key and raw_api_key.strip().lower() in {"your-sendgrid-api-key", "changeme", "placeholder"}:
            raw_api_key = None

        self.api_key = raw_api_key
        self.from_email = os.getenv("FROM_EMAIL", "noreply@yachtversal.com")
        self.notifications_email = os.getenv("NOTIFICATIONS_EMAIL", "inquiries@yachtversal.com")
        self.base_url = os.getenv("BASE_URL", "https://yachtversal.com")

        self._jinja = Environment(
            loader=FileSystemLoader(str(_TEMPLATE_DIR)),
            autoescape=select_autoescape(["html"]),
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _render(self, template_name: str, **ctx) -> str:
        """Render a Jinja2 HTML template from email_templates/."""
        tmpl = self._jinja.get_template(template_name)
        return tmpl.render(**ctx)

    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        reply_to: str | None = None,
        from_email: str | None = None,
    ):
        """
        Send email via SendGrid.

        Args:
            reply_to: Optional Reply-To address -- used by the email-reply
                      routing feature so recipients can reply without logging in.
            from_email: Override the default From address (e.g. use
                        notifications_email for inquiry/conversational emails).
        """
        if not self.api_key:
            message = f"SendGrid not configured. Failed to send email to {to_email}: {subject}"
            logging.error(message)
            raise RuntimeError(message)

        try:
            from sendgrid.helpers.mail import ReplyTo

            message = Mail(
                from_email=from_email or self.from_email,
                to_emails=to_email,
                subject=subject,
                html_content=html_content,
            )
            if reply_to:
                message.reply_to = ReplyTo(reply_to)

            sg = SendGridAPIClient(self.api_key)
            response = sg.send(message)

            logging.info(f"Email sent to {to_email}: {subject} (Status: {response.status_code})")
            return True

        except Exception as e:
            logging.error(f"Failed to send email to {to_email}: {str(e)}")
            return False

    # ------------------------------------------------------------------
    # Transactional emails
    # ------------------------------------------------------------------

    def send_api_key_email(self, to_email: str, dealer_name: str, api_key: str, tier: str):
        """Send API key to dealer after registration."""
        tier_limits = {
            "free":    {"requests": "100/day",    "listings": "5"},
            "basic":   {"requests": "1,000/day",  "listings": "50"},
            "premium": {"requests": "10,000/day", "listings": "Unlimited"},
        }
        limits = tier_limits.get(tier, tier_limits["free"])

        html = self._render(
            "api_key.html",
            dealer_name=dealer_name,
            api_key=api_key,
            tier_title=tier.title(),
            requests_limit=limits["requests"],
            listings_limit=limits["listings"],
            dashboard_url=f"{self.base_url}/dashboard/api-keys",
        )
        return self.send_email(to_email, "Your YachtVersal API Key", html)

    def send_wordpress_site_created(
        self, to_email, dealer_name, site_domain, api_key, wp_admin_url, wp_username, wp_password
    ):
        """Send WordPress site creation email with credentials."""
        html = self._render(
            "wordpress_site_created.html",
            dealer_name=dealer_name,
            site_domain=site_domain,
            api_key=api_key,
            wp_admin_url=wp_admin_url,
            wp_username=wp_username,
            wp_password=wp_password,
        )
        return self.send_email(to_email, f"Your YachtVersal Website is Ready - {site_domain}", html)

    def send_verification_email(self, to_email: str, token: str, user_name: str = None):
        """Send email verification link."""
        html = self._render(
            "verification.html",
            user_name=user_name,
            verification_url=f"{self.base_url}/verify-email?token={token}",
        )
        return self.send_email(to_email, "Verify Your YachtVersal Account", html)

    def send_welcome_email(self, to_email: str, user_name: str | None = None):
        """Send a welcome/onboarding email with sign-in link."""
        html = self._render(
            "welcome.html",
            greeting=f"Hi {user_name}," if user_name else "Hi there,",
            signin_url=f"{self.base_url}/login",
            dashboard_url=f"{self.base_url}/dashboard",
        )
        return self.send_email(to_email, "Welcome to YachtVersal", html)

    def send_trial_expiring_email(
        self, to_email: str, days_left: int, trial_end_date: str, user_name: str | None = None
    ):
        """Notify a user that their trial is nearing its end."""
        html = self._render(
            "trial_expiring.html",
            greeting=f"Hi {user_name}," if user_name else "Hi there,",
            days_left=days_left,
            trial_end_date=trial_end_date,
            billing_url=f"{self.base_url}/dashboard/billing",
            signin_url=f"{self.base_url}/login",
        )
        return self.send_email(to_email, "Your YachtVersal trial is ending soon", html)

    def send_dealer_invitation(self, to_email: str, token: str, sales_rep_name: str, company_name: str = None):
        """Send dealer invitation from sales rep."""
        html = self._render(
            "dealer_invitation.html",
            sales_rep_name=sales_rep_name,
            invitee=f"{company_name} " if company_name else "you ",
            invitation_url=f"{self.base_url}/register/invited?token={token}",
        )
        return self.send_email(to_email, f"You're Invited to Join YachtVersal by {sales_rep_name}", html)

    def send_2fa_code(self, to_email: str, code: str, user_name: str = None):
        """Send 2FA verification code."""
        html = self._render(
            "two_factor_code.html",
            user_name=user_name,
            code=code,
        )
        return self.send_email(to_email, "Your YachtVersal Verification Code", html)

    def send_promotional_offer_notification(self, to_email: str, offer_details: dict):
        """Notify dealer about promotional offer."""
        html = self._render(
            "promotional_offer.html",
            discount=offer_details.get("discount"),
            trial_days=offer_details.get("trial_days"),
            end_date=offer_details.get("end_date"),
            login_url=f"{self.base_url}/login",
        )
        return self.send_email(to_email, "You've Received a Special Offer!", html)

    def send_password_set_email(self, to_email: str, name: str, set_password_url: str):
        """Send an email to a newly-created broker so they can set their own password."""
        html = self._render(
            "password_set.html",
            greeting=f"Hi {name}," if name else "Hi there,",
            set_password_url=set_password_url,
            login_url=f"{self.base_url}/login/seller",
        )
        return self.send_email(to_email, "Set Your YachtVersal Password", html)

    def send_password_reset_email(self, to_email: str, token: str, user_name: str = None):
        """Send a password-reset link to the user."""
        reset_url = f"{self.base_url}/reset-password?token={token}"
        html = self._render(
            "password_reset.html",
            greeting=f"Hi {user_name}," if user_name else "Hi there,",
            reset_url=reset_url,
        )
        return self.send_email(to_email, "Reset Your YachtVersal Password", html)


# Singleton instance
email_service = EmailService()
