from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi import FastAPI
import logging

from app.exceptions import (
    YachtVersalException,
    ValidationException,
)

logger = logging.getLogger("yachtversal")


async def yachtversal_exception_handler(request: Request, exc: YachtVersalException):
    logger.warning(f"YachtVersal exception: {exc.message}")
    response = {"error": exc.message, "status_code": exc.status_code}
    if hasattr(exc, "details") and exc.details:
        response["details"] = exc.details
    return JSONResponse(status_code=exc.status_code, content=response)


async def http_exception_handler(request: Request, exc):
    logger.warning(f"HTTP exception: {exc.detail}")
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


async def validation_exception_handler(request: Request, exc):
    logger.warning(f"Validation error: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"error": "Validation error", "details": exc.errors()},
    )


async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "An unexpected error occurred"},
    )


def register_exception_handlers(app: FastAPI):
    app.add_exception_handler(YachtVersalException, yachtversal_exception_handler)
    app.add_exception_handler(ValidationException, validation_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)