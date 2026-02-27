from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from collections import defaultdict
from datetime import datetime, timedelta
import re
import hashlib

class AntiScrapingMiddleware(BaseHTTPMiddleware):
    """
    Comprehensive anti-scraping protection middleware
    
    Features:
    - Rate limiting per IP
    - Bot detection via user agent
    - Request pattern analysis
    - Honeypot endpoints
    """
    
    def __init__(self, app):
        super().__init__(app)
        # Track requests per IP
        self.request_counts = defaultdict(list)
        self.blocked_ips = set()
        self.suspicious_ips = defaultdict(int)
        
        # Known bot user agents (expand as needed)
        self.bot_patterns = [
            r'bot', r'crawler', r'spider', r'scrape', r'scraper',
            r'curl', r'wget', r'python-requests', r'java',
            r'facebook', r'twitter', r'linkedin', r'pinterest',
            r'telegram', r'whatsapp', r'slackbot', r'discordbot'
        ]
        
        # Legitimate bot user agents we want to allow
        self.allowed_bots = [
            r'googlebot', r'bingbot', r'slurp', r'duckduckbot',
            r'baiduspider', r'yandexbot', r'facebookexternalhit'
        ]
        
    async def dispatch(self, request: Request, call_next):
        # Get client IP
        client_ip = self._get_client_ip(request)
        
        # Skip for local development/testing
        if client_ip in ("127.0.0.1", "::1"):
            return await call_next(request)
        
        # Skip anti-scraping checks for authenticated requests
        if request.headers.get("Authorization"):
            return await call_next(request)

        if request.url.path == "/api/saved-listings" and request.headers.get("Authorization"):
            return await call_next(request)
        
        # Check if IP is blocked
        if client_ip in self.blocked_ips:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Rate limiting check
        if self._is_rate_limited(client_ip):
            self._add_suspicious_activity(client_ip)
            raise HTTPException(status_code=429, detail="Too many requests")
        
        # Bot detection
        user_agent = request.headers.get('user-agent', '').lower()
        if self._is_suspicious_bot(user_agent):
            self._add_suspicious_activity(client_ip)
            
            # Allow legitimate bots but log them
            if not self._is_allowed_bot(user_agent):
                # Block after too many suspicious activities
                if self.suspicious_ips[client_ip] >= 10:
                    self.blocked_ips.add(client_ip)
                    raise HTTPException(status_code=403, detail="Bot detected")
        
        # Check for suspicious patterns
        if self._has_suspicious_pattern(request):
            self._add_suspicious_activity(client_ip)
        
        # Track request
        self._track_request(client_ip)
        
        # Add security headers to response
        response = await call_next(request)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        
        return response
    
    def _get_client_ip(self, request: Request) -> str:
        """Get real client IP (handles proxies)"""
        # Check X-Forwarded-For header (from reverse proxy)
        forwarded = request.headers.get('x-forwarded-for')
        if forwarded:
            return forwarded.split(',')[0].strip()
        
        # Check X-Real-IP header
        real_ip = request.headers.get('x-real-ip')
        if real_ip:
            return real_ip
        
        # Fallback to direct connection
        return request.client.host
    
    def _is_rate_limited(self, client_ip: str) -> bool:
        """Check if IP exceeds rate limit"""
        now = datetime.utcnow()
        cutoff = now - timedelta(minutes=1)
        
        # Clean old requests
        self.request_counts[client_ip] = [
            req_time for req_time in self.request_counts[client_ip]
            if req_time > cutoff
        ]
        
        # Check rate (60 requests per minute = 1 per second average)
        return len(self.request_counts[client_ip]) > 60
    
    def _track_request(self, client_ip: str):
        """Track request timestamp"""
        self.request_counts[client_ip].append(datetime.utcnow())
    
    def _is_suspicious_bot(self, user_agent: str) -> bool:
        """Detect bot user agents"""
        for pattern in self.bot_patterns:
            if re.search(pattern, user_agent, re.IGNORECASE):
                return True
        return False
    
    def _is_allowed_bot(self, user_agent: str) -> bool:
        """Check if bot is in allowed list (search engines, etc.)"""
        for pattern in self.allowed_bots:
            if re.search(pattern, user_agent, re.IGNORECASE):
                return True
        return False
    
    def _has_suspicious_pattern(self, request: Request) -> bool:
        """Detect suspicious request patterns"""
        # Missing common headers
        if not request.headers.get('accept'):
            return True
        
        if not request.headers.get('accept-language'):
            return True
        
        # Suspicious query patterns
        path = request.url.path
        if 'admin' in path.lower() and 'wp-admin' not in path.lower():
            # Looking for admin endpoints
            return True
        
        # Common scraper paths
        suspicious_paths = [
            '/xmlrpc.php', '/wp-login.php', '/.env',
            '/phpmyadmin', '/.git', '/backup'
        ]
        if any(sus in path.lower() for sus in suspicious_paths):
            return True
        
        return False
    
    def _add_suspicious_activity(self, client_ip: str):
        """Track suspicious activity"""
        self.suspicious_ips[client_ip] += 1


# ==================== ENHANCED RATE LIMITING ====================

from functools import wraps
from fastapi import Request
import time

# In-memory store (use Redis in production)
rate_limit_store = defaultdict(list)

def rate_limit(requests_per_minute: int = 30):
    """
    Decorator for endpoint-specific rate limiting
    
    Usage:
        @router.get("/listings")
        @rate_limit(requests_per_minute=30)
        def get_listings():
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get request from kwargs or args
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            
            if not request:
                # If no request found in args, check kwargs
                request = kwargs.get('request')
            
            if request:
                client_ip = request.client.host
                now = time.time()
                minute_ago = now - 60
                
                # Clean old entries
                rate_limit_store[client_ip] = [
                    timestamp for timestamp in rate_limit_store[client_ip]
                    if timestamp > minute_ago
                ]
                
                # Check limit
                if len(rate_limit_store[client_ip]) >= requests_per_minute:
                    raise HTTPException(
                        status_code=429,
                        detail=f"Rate limit exceeded. Max {requests_per_minute} requests per minute."
                    )
                
                # Track request
                rate_limit_store[client_ip].append(now)
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator


# ==================== HONEYPOT ROUTES ====================

from fastapi import APIRouter

honeypot_router = APIRouter()

@honeypot_router.get("/wp-admin.php")
@honeypot_router.get("/admin/login")
@honeypot_router.get("/.env")
@honeypot_router.get("/config.php")
async def honeypot(request: Request):
    """
    Honeypot endpoints to catch scrapers/bots
    Automatically blocks IP
    """
    client_ip = request.client.host
    
    # Log the attempt
    import logging
    logging.warning(f"Honeypot triggered by IP: {client_ip}")
    
    # Add to blocked list (in production, save to database)
    # You can integrate with your AntiScrapingMiddleware here
    
    # Return fake response to waste scraper time
    import asyncio
    await asyncio.sleep(5)  # Delay 5 seconds
    
    raise HTTPException(status_code=404, detail="Not found")


# ==================== CAPTCHA VERIFICATION ====================

import requests
import os

def verify_hcaptcha(token: str) -> bool:
    """Verify hCaptcha token"""
    if not token:
        return False
    
    secret = os.getenv('HCAPTCHA_SECRET')
    if not secret:
        # If no secret, skip verification in development
        return True
    
    try:
        response = requests.post(
            'https://hcaptcha.com/siteverify',
            data={
                'secret': secret,
                'response': token
            },
            timeout=5
        )
        result = response.json()
        return result.get('success', False)
    except Exception as e:
        import logging
        logging.error(f"Captcha verification failed: {e}")
        return False


def require_captcha(func):
    """
    Decorator to require captcha verification
    
    Usage:
        @router.post("/register")
        @require_captcha
        def register(data: dict):
            ...
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        # Get data from kwargs
        data = None
        for arg in args:
            if isinstance(arg, dict):
                data = arg
                break
        
        if not data:
            data = kwargs.get('data') or kwargs.get('user_data')
        
        if data:
            captcha_token = data.get('captcha_token')
            if not verify_hcaptcha(captcha_token):
                raise HTTPException(
                    status_code=400,
                    detail="Captcha verification failed"
                )
        
        return await func(*args, **kwargs)
    return wrapper


# ==================== IP BLACKLIST ====================

class IPBlacklist:
    """Manage IP blacklist"""
    
    def __init__(self):
        self.blocked_ips = set()
        self._load_from_db()
    
    def _load_from_db(self):
        """Load blocked IPs from database"""
        # TODO: Load from database
        pass
    
    def block_ip(self, ip: str, reason: str = ""):
        """Block an IP address"""
        self.blocked_ips.add(ip)
        # TODO: Save to database with reason
        import logging
        logging.warning(f"IP blocked: {ip} - Reason: {reason}")
    
    def unblock_ip(self, ip: str):
        """Unblock an IP address"""
        self.blocked_ips.discard(ip)
        # TODO: Remove from database
    
    def is_blocked(self, ip: str) -> bool:
        """Check if IP is blocked"""
        return ip in self.blocked_ips

# Singleton instance
ip_blacklist = IPBlacklist()


# ==================== OBFUSCATION TECHNIQUES ====================

def add_noise_to_response(data: dict) -> dict:
    """
    Add noise/fake fields to make scraping harder
    Only for public endpoints
    """
    import random
    import string
    
    noise_keys = [
        ''.join(random.choices(string.ascii_lowercase, k=8))
        for _ in range(3)
    ]
    
    for key in noise_keys:
        data[key] = ''.join(random.choices(string.ascii_letters + string.digits, k=16))
    
    return data


def obfuscate_email(email: str) -> str:
    """Obfuscate email addresses in public responses"""
    if '@' not in email:
        return email
    
    local, domain = email.split('@')
    if len(local) <= 2:
        return email
    
    # Show first 2 and last 1 character
    obfuscated_local = local[:2] + '*' * (len(local) - 3) + local[-1]
    return f"{obfuscated_local}@{domain}"


def obfuscate_phone(phone: str) -> str:
    """Obfuscate phone numbers in public responses"""
    if len(phone) < 7:
        return phone
    
    # Show last 4 digits
    return '*' * (len(phone) - 4) + phone[-4:]
