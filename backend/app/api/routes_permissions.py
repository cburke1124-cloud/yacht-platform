from fastapi import APIRouter, Depends
from app.api.deps import get_current_user
from app.models.user import User
from app.services.permissions import get_user_permissions, ROLE_PERMISSIONS

router = APIRouter()


@router.get("/my")
def get_my_permissions(current_user: User = Depends(get_current_user)):
    perms = get_user_permissions(current_user)
    return {
        "role": current_user.user_type,
        "permissions": [p.value for p in perms],
        "custom_permissions": current_user.permissions or {},
    }


@router.get("/roles")
def get_role_permissions():
    return {
        role.value: [p.value for p in perms]
        for role, perms in ROLE_PERMISSIONS.items()
    }