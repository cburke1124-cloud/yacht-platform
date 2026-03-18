from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
import logging

from app.exceptions import (
    YachtVersalException,
    ValidationException,
)

logger = logging.getLogger("yachtversal")


async def yachtversal_exception_handler(request: Request, exc: YachtVersalException):
    logger.warning(f"YachtVersal exception: {exc.message}")
    response = {"error": exc.message, "detail": exc.message, "status_code": exc.status_code}
    if hasattr(exc, "details") and exc.details:
        response["details"] = exc.details
    json_response = JSONResponse(status_code=exc.status_code, content=response)
    # Attach CORS headers so the browser's fetch() can read the response body
    # even on error status codes (without these headers the browser gets a
    # TypeError instead of a response object with the error detail).
    origin = request.headers.get("origin", "")
    if origin:
        json_response.headers["Access-Control-Allow-Origin"] = origin
        json_response.headers["Access-Control-Allow-Credentials"] = "true"
    return json_response


async def http_exception_handler(request: Request, exc):
    logger.warning(f"HTTP exception: {exc.detail}")
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


async def pydantic_validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"Pydantic validation error: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"error": "Validation error", "details": exc.errors()},
    )


async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    origin = request.headers.get("origin", "")
    response = JSONResponse(
        status_code=500,
        content={"error": "An unexpected error occurred", "detail": str(exc)},
    )
    # Manually attach CORS headers so the browser can read the 500 body even
    # when ServerErrorMiddleware short-circuits the outer middleware stack.
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response


def register_exception_handlers(app: FastAPI):
    app.add_exception_handler(YachtVersalException, yachtversal_exception_handler)
    app.add_exception_handler(RequestValidationError, pydantic_validation_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)