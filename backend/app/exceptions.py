from fastapi import HTTPException

class YachtVersalException(Exception):
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class ValidationException(YachtVersalException):
    def __init__(self, message: str, details=None):
        super().__init__(message, 400)
        self.details = details


class AuthenticationException(YachtVersalException):
    def __init__(self, message="Authentication failed"):
        super().__init__(message, 401)


class AuthorizationException(YachtVersalException):
    def __init__(self, message="Not authorized"):
        super().__init__(message, 403)


class ResourceNotFoundException(YachtVersalException):
    def __init__(self, resource: str, id=None):
        msg = f"{resource} not found"
        if id:
            msg += f" (ID: {id})"
        super().__init__(msg, 404)


class BusinessLogicException(YachtVersalException):
    def __init__(self, message: str):
        super().__init__(message, 422)


class ExternalServiceException(YachtVersalException):
    def __init__(self, message: str):
        super().__init__(message, 502)