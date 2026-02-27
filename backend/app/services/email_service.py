import logging
import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from dotenv import load_dotenv, find_dotenv

class EmailService:
    def __init__(self):
        load_dotenv(find_dotenv(), override=False)

        raw_api_key = os.getenv("SENDGRID_API_KEY")
        if raw_api_key and raw_api_key.strip().lower() in {"your-sendgrid-api-key", "changeme", "placeholder"}:
            raw_api_key = None

        self.api_key = raw_api_key
        self.from_email = os.getenv("FROM_EMAIL", "noreply@yachtversal.com")
        self.base_url = os.getenv("BASE_URL", "https://yachtversal.com")
        
    def send_email(self, to_email: str, subject: str, html_content: str):
        """Send email via SendGrid"""
        if not self.api_key:
            message = f"SendGrid not configured. Failed to send email to {to_email}: {subject}"
            logging.error(message)
            raise RuntimeError(message)
            
        try:
            message = Mail(
                from_email=self.from_email,
                to_emails=to_email,
                subject=subject,
                html_content=html_content
            )
            
            sg = SendGridAPIClient(self.api_key)
            response = sg.send(message)
            
            logging.info(f"Email sent to {to_email}: {subject} (Status: {response.status_code})")
            return True
            
        except Exception as e:
            logging.error(f"Failed to send email to {to_email}: {str(e)}")
            return False
    
    def send_api_key_email(self, to_email: str, dealer_name: str, api_key: str, tier: str):
        """Send API key to dealer after registration"""
        
        tier_limits = {
            "free": {"requests": "100/day", "listings": "5"},
            "basic": {"requests": "1,000/day", "listings": "50"},
            "premium": {"requests": "10,000/day", "listings": "Unlimited"}
        }
        
        limits = tier_limits.get(tier, tier_limits["free"])
        
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(to right, #2563eb, #1e40af); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Your YachtVersal API Key</h1>
                </div>
                
                <div style="padding: 30px; background: #f9fafb;">
                    <h2 style="color: #1f2937;">Welcome, {dealer_name}!</h2>
                    
                    <p style="color: #4b5563; line-height: 1.6;">
                        Your API key has been generated. This key allows you to access the YachtVersal API programmatically.
                    </p>
                    
                    <div style="background: white; padding: 25px; border-radius: 12px; margin: 30px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <h3 style="color: #2563eb; margin-top: 0;">Your API Key</h3>
                        <code style="background: #f1f5f9; padding: 12px; display: block; font-size: 13px; word-break: break-all; border-radius: 4px; border-left: 4px solid #2563eb;">
                            {api_key}
                        </code>
                    </div>
                    
                    <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 20px 0;">
                        <p style="margin: 0; color: #92400e;">
                            <strong>⚠️ Important:</strong> Save this key securely! It will not be shown again for security reasons.
                        </p>
                    </div>
                    
                    <div style="background: white; padding: 25px; border-radius: 12px; margin: 30px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <h3 style="color: #2563eb; margin-top: 0;">Your {tier.title()} Plan Limits</h3>
                        <ul style="color: #4b5563; line-height: 1.8;">
                            <li><strong>API Requests:</strong> {limits['requests']}</li>
                            <li><strong>Listings:</strong> {limits['listings']}</li>
                        </ul>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{self.base_url}/dashboard/api-keys" 
                           style="background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                            View Dashboard
                        </a>
                    </div>
                </div>
                
                <div style="background: #1f2937; padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
                    <p style="margin: 0;">© 2026 YachtVersal. All rights reserved.</p>
                </div>
            </body>
        </html>
        """
        
        return self.send_email(to_email, "Your YachtVersal API Key", html_content)
    
    def send_wordpress_site_created(self, to_email, dealer_name, site_domain, api_key, wp_admin_url, wp_username, wp_password):
        """Send WordPress site creation email with credentials"""
        
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #0066cc 0%, #003d7a 100%); padding: 40px; text-align: center;">
                    <h1 style="color: white; margin: 0;">🚤 Your YachtVersal Site is Ready!</h1>
                </div>
                
                <div style="padding: 40px; background: #f8fafc;">
                    <h2 style="color: #0066cc;">Welcome, {dealer_name}!</h2>
                    
                    <p style="color: #4b5563; line-height: 1.6;">
                        Your professional yacht dealer website is now live and ready to showcase your inventory!
                    </p>
                    
                    <div style="background: white; padding: 25px; border-radius: 12px; margin: 30px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <h3 style="color: #0066cc; margin-top: 0;">Your Website</h3>
                        <p style="margin: 10px 0;">
                            <strong>URL:</strong> <a href="https://{site_domain}" style="color: #0066cc;">https://{site_domain}</a>
                        </p>
                    </div>
                    
                    <div style="background: white; padding: 25px; border-radius: 12px; margin: 30px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <h3 style="color: #0066cc; margin-top: 0;">WordPress Admin Access</h3>
                        <p style="margin: 10px 0;">
                            <strong>Admin URL:</strong> <a href="{wp_admin_url}" style="color: #0066cc;">{wp_admin_url}</a><br>
                            <strong>Username:</strong> {wp_username}<br>
                            <strong>Password:</strong> <code style="background: #f1f5f9; padding: 4px 8px; border-radius: 4px;">{wp_password}</code>
                        </p>
                    </div>
                    
                    <div style="background: white; padding: 25px; border-radius: 12px; margin: 30px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <h3 style="color: #0066cc; margin-top: 0;">YachtVersal API Key</h3>
                        <p style="color: #4b5563; font-size: 14px; margin-bottom: 10px;">
                            Your inventory syncs automatically. This key is pre-configured in your site.
                        </p>
                        <code style="background: #f1f5f9; padding: 12px; display: block; font-size: 12px; word-break: break-all; border-radius: 4px; border-left: 4px solid #0066cc;">
                            {api_key}
                        </code>
                    </div>
                    
                    <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 30px 0;">
                        <p style="margin: 0; color: #92400e;">
                            <strong>⚠️ Important:</strong> Save these credentials securely! Change your WordPress password after first login.
                        </p>
                    </div>
                    
                    <h3 style="color: #0066cc; margin-top: 40px;">What's Next?</h3>
                    <ol style="color: #4b5563; line-height: 1.8;">
                        <li>Visit your new website at <a href="https://{site_domain}">{site_domain}</a></li>
                        <li>Log in to WordPress admin to customize your branding</li>
                        <li>Your yacht inventory syncs automatically every 24 hours</li>
                        <li>Check out the YachtVersal dashboard in your admin panel</li>
                    </ol>
                    
                    <div style="margin-top: 40px; text-align: center;">
                        <a href="https://{site_domain}/wp-admin" 
                           style="background: #0066cc; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; margin-right: 10px;">
                            Go to WordPress Admin
                        </a>
                        <a href="https://sites.yachtversal.com/help" 
                           style="background: white; color: #0066cc; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; border: 2px solid #0066cc;">
                            View Help Docs
                        </a>
                    </div>
                    
                    <p style="margin-top: 40px; color: #6b7280; font-size: 14px;">
                        Need help? Reply to this email or visit our 
                        <a href="https://sites.yachtversal.com/help" style="color: #0066cc;">help center</a>.
                    </p>
                </div>
                
                <div style="background: #1e293b; padding: 20px; text-align: center; color: white;">
                    <p style="margin: 0; font-size: 14px;">© 2026 YachtVersal. All rights reserved.</p>
                </div>
            </body>
        </html>
        """
        
        return self.send_email(to_email, f"Your YachtVersal Website is Ready - {site_domain}", html_content)
    
    def send_verification_email(self, to_email: str, token: str, user_name: str = None):
        """Send email verification"""
        verification_url = f"{self.base_url}/verify-email?token={token}"
        
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(to right, #2563eb, #1e40af); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">YachtVersal</h1>
                </div>
                
                <div style="padding: 30px; background: #f9fafb;">
                    <h2 style="color: #1f2937;">Verify Your Email</h2>
                    
                    <p style="color: #4b5563; line-height: 1.6;">
                        Hi{f" {user_name}" if user_name else ""},
                    </p>
                    
                    <p style="color: #4b5563; line-height: 1.6;">
                        Thank you for signing up with YachtVersal! Please verify your email address to activate your account and access all features.
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{verification_url}" 
                           style="background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                            Verify Email Address
                        </a>
                    </div>
                    
                    <p style="color: #6b7280; font-size: 14px;">
                        Or copy and paste this link into your browser:<br>
                        <a href="{verification_url}" style="color: #2563eb;">{verification_url}</a>
                    </p>
                    
                    <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                        This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
                    </p>
                </div>
                
                <div style="background: #1f2937; padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
                    <p style="margin: 0;">© 2026 YachtVersal. All rights reserved.</p>
                </div>
            </body>
        </html>
        """
        
        return self.send_email(to_email, "Verify Your YachtVersal Account", html_content)
    
    def send_dealer_invitation(self, to_email: str, token: str, sales_rep_name: str, company_name: str = None):
        """Send dealer invitation from sales rep"""
        invitation_url = f"{self.base_url}/register/invited?token={token}"
        
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(to right, #2563eb, #1e40af); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">YachtVersal</h1>
                </div>
                
                <div style="padding: 30px; background: #f9fafb;">
                    <h2 style="color: #1f2937;">You're Invited to Join YachtVersal!</h2>
                    
                    <p style="color: #4b5563; line-height: 1.6;">
                        {sales_rep_name} has invited {f"{company_name} " if company_name else "you "}to join YachtVersal, the premier yacht marketplace platform.
                    </p>
                    
                    <div style="background: white; border-left: 4px solid #2563eb; padding: 20px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #1f2937;">Why Join YachtVersal?</h3>
                        <ul style="color: #4b5563; line-height: 1.8;">
                            <li>List unlimited yachts with our AI-powered tools</li>
                            <li>Reach thousands of qualified buyers</li>
                            <li>Advanced analytics and insights</li>
                            <li>Dedicated sales rep support</li>
                        </ul>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{invitation_url}" 
                           style="background: #2563eb; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
                            Accept Invitation
                        </a>
                    </div>
                    
                    <p style="color: #6b7280; font-size: 14px;">
                        Or copy and paste this link:<br>
                        <a href="{invitation_url}" style="color: #2563eb;">{invitation_url}</a>
                    </p>
                    
                    <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                        This invitation expires in 7 days. Questions? Contact {sales_rep_name} directly.
                    </p>
                </div>
                
                <div style="background: #1f2937; padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
                    <p style="margin: 0;">© 2026 YachtVersal. All rights reserved.</p>
                </div>
            </body>
        </html>
        """
        
        return self.send_email(to_email, f"You're Invited to Join YachtVersal by {sales_rep_name}", html_content)
    
    def send_2fa_code(self, to_email: str, code: str, user_name: str = None):
        """Send 2FA verification code"""
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(to right, #2563eb, #1e40af); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">YachtVersal</h1>
                </div>
                
                <div style="padding: 30px; background: #f9fafb;">
                    <h2 style="color: #1f2937;">Your Verification Code</h2>
                    
                    <p style="color: #4b5563; line-height: 1.6;">
                        Hi{f" {user_name}" if user_name else ""},
                    </p>
                    
                    <p style="color: #4b5563; line-height: 1.6;">
                        You're signing in to YachtVersal. Use this code to complete your login:
                    </p>
                    
                    <div style="background: white; border: 2px solid #2563eb; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
                        <div style="font-size: 36px; font-weight: bold; color: #2563eb; letter-spacing: 8px; font-family: monospace;">
                            {code}
                        </div>
                    </div>
                    
                    <p style="color: #6b7280; font-size: 14px;">
                        This code expires in 10 minutes. If you didn't request this code, please ignore this email and ensure your account is secure.
                    </p>
                </div>
                
                <div style="background: #1f2937; padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
                    <p style="margin: 0;">© 2026 YachtVersal. All rights reserved.</p>
                </div>
            </body>
        </html>
        """
        
        return self.send_email(to_email, "Your YachtVersal Verification Code", html_content)
    
    def send_promotional_offer_notification(self, to_email: str, offer_details: dict):
        """Notify dealer about promotional offer"""
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(to right, #f59e0b, #d97706); padding: 30px; text-align: center;">
                    <h1 style="color: white; margin: 0;">🎉 Special Offer!</h1>
                </div>
                
                <div style="padding: 30px; background: #f9fafb;">
                    <h2 style="color: #1f2937;">You've Received a Special Offer</h2>
                    
                    <p style="color: #4b5563; line-height: 1.6;">
                        Great news! Your account has been upgraded with a special promotional offer:
                    </p>
                    
                    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #92400e;">Offer Details</h3>
                        <ul style="color: #78350f; line-height: 1.8;">
                            {f"<li><strong>Discount:</strong> {offer_details.get('discount')} off</li>" if offer_details.get('discount') else ""}
                            {f"<li><strong>Trial Period:</strong> {offer_details.get('trial_days')} days free</li>" if offer_details.get('trial_days') else ""}
                            {f"<li><strong>Valid Until:</strong> {offer_details.get('end_date')}</li>" if offer_details.get('end_date') else ""}
                        </ul>
                    </div>
                    
                    <p style="color: #4b5563; line-height: 1.6;">
                        Log in to your account to start using your benefits immediately!
                    </p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{self.base_url}/login" 
                           style="background: #2563eb; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                            Access Your Account
                        </a>
                    </div>
                </div>
                
                <div style="background: #1f2937; padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
                    <p style="margin: 0;">© 2026 YachtVersal. All rights reserved.</p>
                </div>
            </body>
        </html>
        """
        
        return self.send_email(to_email, "🎉 You've Received a Special Offer!", html_content)


# Singleton instance
email_service = EmailService()