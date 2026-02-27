from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request
from datetime import datetime
import logging

logger = logging.getLogger("yachtversal")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        logger.info(f"Request: {request.method} {request.url.path}")

        start = datetime.now()

        try:
            response = await call_next(request)
            duration = (datetime.now() - start).total_seconds()
            logger.info(f"Response {response.status_code} in {duration:.3f}s")
            return response
        except Exception as e:
            duration = (datetime.now() - start).total_seconds()
            logger.error(f"Request failed after {duration:.3f}s: {str(e)}")
            raise