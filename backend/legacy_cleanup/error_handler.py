# File: error_handler.py
# Enhanced error handling with logging

import logging
from datetime import datetime
from typing import Optional
import traceback
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import json
import html
import re


# ============================================
# LOGGING SETUP
# ============================================

def setup_logging(
    log_level: str = "INFO",
    log_file: str = "logs/yachtversal.log",
    json_logs: bool = False
):
    """Configure application logging"""
    
    # Create logger
    logger = logging.getLogger("yachtversal")
    logger.setLevel(getattr(logging, log_level.upper()))
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    
    # File handler
    try:
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(logging.DEBUG)
    except Exception as e:
        print(f"Warning: Could not create log file: {e}")
        file_handler = None
    
    # Format
    if json_logs:
        formatter = logging.Formatter(
            '{"timestamp": "%(asctime)s", "level": "%(levelname)s", '
            '"module": "%(module)s", "message": "%(message)s"}'
        )
    else:
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
    
    console_handler.setFormatter(formatter)
    if file_handler:
        file_handler.setFormatter(formatter)
    
    logger.addHandler(console_handler)
    if file_handler:
        logger.addHandler(file_handler)
    
    return logger


logger = logging.getLogger("yachtversal")


def error_logger(func):
    """Decorator to log errors in functions"""
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except Exception as e:
            logger.error(f"Error in {func.__name__}: {str(e)}", exc_info=True)
            raise
    return wrapper


# ============================================
# CUSTOM EXCEPTIONS
# ============================================

class YachtVersalException(Exception):
    """Base exception for YachtVersal"""
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class ValidationException(YachtVersalException):
    """Validation error"""
    def __init__(self, message: str, details: Optional[dict] = None):
        super().__init__(message, 400)
        self.details = details


class AuthenticationException(YachtVersalException):
    """Authentication error"""
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message, 401)


class AuthorizationException(YachtVersalException):
    """Authorization error"""
    def __init__(self, message: str = "Not authorized"):
        super().__init__(message, 403)


class ResourceNotFoundException(YachtVersalException):
    """Resource not found"""
    def __init__(self, resource: str, id: Optional[int] = None):
        message = f"{resource} not found"
        if id:
            message += f" (ID: {id})"
        super().__init__(message, 404)


class BusinessLogicException(YachtVersalException):
    """Business logic error"""
    def __init__(self, message: str):
        super().__init__(message, 422)


class ExternalServiceException(YachtVersalException):
    """External service error"""
    def __init__(self, message: str):
        super().__init__(message, 502)


# ============================================
# REQUEST LOGGING MIDDLEWARE
# ============================================

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log all HTTP requests"""
    
    async def dispatch(self, request: Request, call_next):
        # Log request
        logger.info(
            f"Request: {request.method} {request.url.path} "
            f"from {request.client.host if request.client else 'unknown'}"
        )
        
        start_time = datetime.now()
        
        try:
            response = await call_next(request)
            
            # Log response
            duration = (datetime.now() - start_time).total_seconds()
            logger.info(
                f"Response: {response.status_code} "
                f"in {duration:.3f}s"
            )
            
            return response
            
        except Exception as e:
            duration = (datetime.now() - start_time).total_seconds()
            logger.error(
                f"Request failed after {duration:.3f}s: {str(e)}",
                exc_info=True
            )
            raise


# ============================================
# EXCEPTION HANDLERS
# ============================================

async def yachtversal_exception_handler(request: Request, exc: YachtVersalException):
    """Handle custom exceptions"""
    logger.warning(
        f"YachtVersal exception: {exc.message} "
        f"(Status: {exc.status_code})"
    )
    
    response = {
        "error": exc.message,
        "status_code": exc.status_code
    }
    
    if hasattr(exc, 'details') and exc.details:
        response["details"] = exc.details
    
    return JSONResponse(
        status_code=exc.status_code,
        content=response
    )


async def http_exception_handler(request: Request, exc):
    """Handle HTTP exceptions"""
    logger.warning(f"HTTP exception: {exc.detail} (Status: {exc.status_code})")
    
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail}
    )


async def validation_exception_handler(request: Request, exc):
    """Handle validation exceptions"""
    logger.warning(f"Validation error: {exc.errors()}")
    
    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation error",
            "details": exc.errors()
        }
    )


async def generic_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions"""
    logger.error(
        f"Unhandled exception: {str(exc)}",
        exc_info=True
    )
    
    # Don't expose internal errors in production
    return JSONResponse(
        status_code=500,
        content={
            "error": "An unexpected error occurred",
            "message": "Please try again later"
        }
    )


# ============================================
# INPUT SANITIZATION UTILITIES
# ============================================

class InputSanitizer:
    """Sanitize user inputs to prevent XSS and injection attacks"""
    
    @staticmethod
    def sanitize_string(text: str, max_length: int = 5000) -> str:
        """Sanitize text input"""
        if not text:
            return ""
        
        # Truncate to max length
        text = text[:max_length]
        
        # HTML escape
        text = html.escape(text)
        
        # Remove any remaining dangerous characters
        text = re.sub(r'[<>]', '', text)
        
        return text.strip()
    
    @staticmethod
    def sanitize_email(email: str) -> str:
        """Validate and sanitize email"""
        if not email:
            return ""
        
        email = email.lower().strip()
        
        # Basic email validation
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(pattern, email):
            raise ValidationException("Invalid email format")
        
        return email
    
    @staticmethod
    def sanitize_phone(phone: str) -> str:
        """Sanitize phone number"""
        if not phone:
            return ""
        
        # Remove all non-digit characters
        phone = re.sub(r'\D', '', phone)
        
        # Validate length (7-15 digits)
        if len(phone) < 7 or len(phone) > 15:
            raise ValidationException("Invalid phone number")
        
        return phone
    
    @staticmethod
    def sanitize_url(url: str) -> str:
        """Validate and sanitize URL"""
        if not url:
            return ""
        
        url = url.strip()
        
        # Must start with http:// or https://
        if not url.startswith(('http://', 'https://')):
            raise ValidationException("URL must start with http:// or https://")
        
        # Basic URL validation
        pattern = r'^https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(/.*)?$'
        if not re.match(pattern, url):
            raise ValidationException("Invalid URL format")
        
        return url
    
    @staticmethod
    def sanitize_numeric(value, min_val: float = None, max_val: float = None) -> float:
        """Validate and sanitize numeric input"""
        try:
            num = float(value)
        except (ValueError, TypeError):
            raise ValidationException("Invalid numeric value")
        
        if min_val is not None and num < min_val:
            raise ValidationException(f"Value must be at least {min_val}")
        
        if max_val is not None and num > max_val:
            raise ValidationException(f"Value must be at most {max_val}")
        
        return num