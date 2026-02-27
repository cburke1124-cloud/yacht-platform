import os
import logging
from datetime import datetime
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        # SendGrid
        self.api_key = os.getenv("SENDGRID_API_KEY")
        self.sg = SendGridAPIClient(self.api_key) if self.api_key else None

        # Email addresses
        self.from_email = os.getenv("FROM_EMAIL", "noreply@yachtversal.com")
        self.from_name = os.getenv("FROM_NAME", "YachtVersal")
        self.admin_email = os.getenv("ADMIN_EMAIL", "admin@yachtversal.com")

        # Platform URL
        self.base_url = os.getenv("BASE_URL", "https://yachtversal.com")

        if not self.sg:
            logger.warning("⚠️ SendGrid not configured")

    # -------------------------------------------------------------------------
    # CORE SEND METHOD
    # -------------------------------------------------------------------------
    def send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """Send email using SendGrid"""
        if not self.sg:
            logger.warning(f"[EMAIL] Would send to {to_email}: {subject}")
            return False

        try:
            message = Mail(
                from_email=f"{self.from_name} <{self.from_email}>",
                to_emails=to_email,
                subject=subject,
                html_content=html_content
            )
            response = self.sg.send(message)
            return response.status_code in [200, 202]

        except Exception as e:
            logger.error(f"Email send error: {e}")
            return False

    # -------------------------------------------------------------------------
    # BASE TEMPLATE
    # -------------------------------------------------------------------------
    def _get_base_template(self, content: str) -> str:
        return f"""
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
    body {{
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
        background-color: #f3f4f6;
        margin: 0;
        padding: 0;
        color: #333;
    }}
    .container {{
        max-width: 600px;
        margin: 0 auto;
        background: #fff;
    }}
    .header {{
        background: linear-gradient(135deg, #2563eb, #1e40af);
        padding: 40px 20px;
        text-align: center;
        color: white;
    }}
    .content {{
        padding: 40px 30px;
    }}
    .button {{
        display: inline-block;
        padding: 14px 32px;
        background: #2563eb;
        color: white;
        border-radius: 8px;
        text-decoration: none;
        font-weight: 600;
    }}
    .highlight-box {{
        background: #eff6ff;
        border-left: 4px solid #2563eb;
        padding: 20px;
        margin: 25px 0;
        border-radius: 4px;
    }}
    .warning-box {{
        background: #fef3c7;
        border-left: 4px solid #f59e0b;
        padding: 20px;
        margin: 25px 0;
        border-radius: 4px;
    }}
    .footer {{
        background: #f9fafb;
        padding: 30px;
        text-align: center;
        color: #6b7280;
        font-size: 14px;
        border-top: 1px solid #e5e7eb;
    }}
</style>
</head>
<body>
<div class="container">
    <div class="header">
        <h1>⚓ YachtVersal</h1>
    </div>
    <div class="content">
        {content}
    </div>
    <div class="footer">
        <p>© {datetime.now().year} YachtVersal. All rights reserved.</p>
        <p>
            <a href="{self.base_url}">Website</a> •
            <a href="{self.base_url}/help">Help Center</a> •
            <a href="{self.base_url}/contact">Contact</a>
        </p>
    </div>
</div>
</body>
</html>
"""

    # -------------------------------------------------------------------------
    # USER-FACING EMAILS (from your first file)
    # -------------------------------------------------------------------------

    def send_welcome_email(self, to_email: str, user_name: str, is_trial: bool = False):
        trial_block = """
        <div class="highlight-box">
            <h2>🎉 Your Free Trial is Active!</h2>
            <p>You have 5 days of full access.</p>
        </div>
        """ if is_trial else ""

        content = f"""
            <h1>Welcome to YachtVersal, {user_name}! 🎊</h1>
            <p>We're excited to have you onboard.</p>
            {trial_block}
            <a href="{self.base_url}/dashboard" class="button">Go to Dashboard →</a>
        """

        return self.send_email(
            to_email,
            f"Welcome to YachtVersal{' - Your Trial Starts Now!' if is_trial else '!'}",
            self._get_base_template(content)
        )

    def send_trial_ending_reminder(self, to_email: str, user_name: str, days_left: int):
        content = f"""
            <h1>Your Trial Ends in {days_left} Day{'s' if days_left != 1 else ''}</h1>
            <div class="warning-box">
                <p>Your listings will be set to draft after expiration.</p>
            </div>
            <a href="{self.base_url}/pricing" class="button">View Pricing →</a>
        """
        return self.send_email(
            to_email,
            f"⏰ Your Trial Ends in {days_left} Days",
            self._get_base_template(content)
        )

    def send_password_reset_email(self, to_email: str, token: str, user_name: str = ""):
        url = f"{self.base_url}/reset-password?token={token}"
        content = f"""
            <h1>Password Reset</h1>
            <p>Hi {user_name or 'there'}, click below to reset your password.</p>
            <a href="{url}" class="button">Reset Password →</a>
        """
        return self.send_email(
            to_email,
            "Reset Your Password",
            self._get_base_template(content)
        )

    def send_email_verification(self, to_email: str, token: str, user_name: str = ""):
        url = f"{self.base_url}/verify-email?token={token}"
        content = f"""
            <h1>Verify Your Email</h1>
            <p>Hi {user_name or 'there'}, please verify your email.</p>
            <a href="{url}" class="button">Verify Email →</a>
        """
        return self.send_email(
            to_email,
            "Verify Your Email",
            self._get_base_template(content)
        )

    def send_listing_published_email(self, to_email: str, title: str, listing_id: int, user_name: str = ""):
        url = f"{self.base_url}/listings/{listing_id}"
        content = f"""
            <h1>Your Listing is Live! 🎉</h1>
            <p>{title} is now published.</p>
            <a href="{url}" class="button">View Listing →</a>
        """
        return self.send_email(
            to_email,
            f"Your Listing is Live: {title}",
            self._get_base_template(content)
        )

    def send_2fa_code(self, to_email: str, code: str, user_name: str = ""):
        content = f"""
            <h1>Your Verification Code</h1>
            <div class="highlight-box"><h2>{code}</h2></div>
        """
        return self.send_email(
            to_email,
            f"Your Verification Code: {code}",
            self._get_base_template(content)
        )

    # -------------------------------------------------------------------------
    # INQUIRY EMAILS (merged from both files)
    # -------------------------------------------------------------------------

    def send_inquiry_to_dealer(
        self, dealer_email: str, dealer_name: str, inquirer_name: str, inquirer_email: str,
        inquirer_phone: str, listing_title: str, listing_url: str, message: str
    ) -> bool:
        content = f"""
            <h1>New Inquiry for Your Listing 💬</h1>
            <p><strong>{listing_title}</strong></p>
            <div class="highlight-box">
                <p><strong>Name:</strong> {inquirer_name}</p>
                <p><strong>Email:</strong> {inquirer_email}</p>
                <p><strong>Phone:</strong> {inquirer_phone}</p>
            </div>
            <div class="warning-box">
                <p>{message}</p>
            </div>
            <a href="{listing_url}" class="button">View Listing →</a>
        """
        return self.send_email(
            dealer_email,
            f"New Inquiry: {listing_title}",
            self._get_base_template(content)
        )

    def send_inquiry_confirmation(self, user_email, user_name, dealer_name, listing_title):
        content = f"""
            <h1>Inquiry Sent ✓</h1>
            <p>Thanks {user_name}, your inquiry was sent to {dealer_name}.</p>
        """
        return self.send_email(
            user_email,
            f"Inquiry Sent: {listing_title}",
            self._get_base_template(content)
        )

    # -------------------------------------------------------------------------
    # ADMIN NOTIFICATIONS
    # -------------------------------------------------------------------------

    def notify_admin_new_dealer(self, dealer_name, dealer_email, dealer_company):
        content = f"""
            <h1>New Dealer Signup 🎉</h1>
            <p><strong>Name:</strong> {dealer_name}</p>
            <p><strong>Email:</strong> {dealer_email}</p>
            <p><strong>Company:</strong> {dealer_company}</p>
        """
        return self.send_email(
            self.admin_email,
            f"New Dealer Signup: {dealer_company}",
            self._get_base_template(content)
        )

    def notify_admin_new_listing(self, listing_title: str, dealer_name: str, listing_id: int) -> bool:
        content = f"""
            <h1>New Listing Pending Approval</h1>
            <p><strong>Title:</strong> {listing_title}</p>
            <p><strong>Dealer:</strong> {dealer_name}</p>
            <p><strong>ID:</strong> {listing_id}</p>
        """
        return self.send_email(
            self.admin_email,
            f"New Listing: {listing_title}",
            self._get_base_template(content)
        )


# Global instance
email_service = EmailService()
