from enum import Enum
from typing import Set
from app.models.user import User


class Permission(Enum):
    """Available permissions in the system"""
    VIEW_LISTINGS = "view_listings"
    CREATE_LISTINGS = "create_listings"
    EDIT_LISTINGS = "edit_listings"
    DELETE_LISTINGS = "delete_listings"
    
    VIEW_TEAM = "view_team"
    MANAGE_TEAM = "manage_team"
    
    VIEW_MESSAGES = "view_messages"
    SEND_MESSAGES = "send_messages"
    
    VIEW_ANALYTICS = "view_analytics"
    MANAGE_BILLING = "manage_billing"
    
    ADMIN_ACCESS = "admin_access"


class TeamMemberRole(str, Enum):
    """Team member roles"""
    OWNER = "owner"
    MANAGER = "manager"
    SALESPERSON = "salesperson"
    VIEWER = "viewer"


# Define permissions for each role
ROLE_PERMISSIONS = {
    # Admin has everything
    "admin": set(Permission),
    
    # Dealer (owner) has everything except admin
    "dealer": {
        Permission.VIEW_LISTINGS,
        Permission.CREATE_LISTINGS,
        Permission.EDIT_LISTINGS,
        Permission.DELETE_LISTINGS,
        Permission.VIEW_TEAM,
        Permission.MANAGE_TEAM,
        Permission.VIEW_MESSAGES,
        Permission.SEND_MESSAGES,
        Permission.VIEW_ANALYTICS,
        Permission.MANAGE_BILLING,
    },
    
    # Salesman has limited access
    "salesman": {
        Permission.VIEW_LISTINGS,
        Permission.VIEW_ANALYTICS,
    },
    # team_member is intentionally omitted — their permissions come from
    # TEAM_ROLE_PERMISSIONS (role-based) or user.permissions (custom overrides).
}

# Team member role permissions
TEAM_ROLE_PERMISSIONS = {
    TeamMemberRole.OWNER: {
        Permission.VIEW_LISTINGS: True,
        Permission.CREATE_LISTINGS: True,
        Permission.EDIT_LISTINGS: True,
        Permission.DELETE_LISTINGS: True,
        Permission.VIEW_TEAM: True,
        Permission.MANAGE_TEAM: True,
        Permission.VIEW_MESSAGES: True,
        Permission.SEND_MESSAGES: True,
        Permission.VIEW_ANALYTICS: True,
        Permission.MANAGE_BILLING: True,
    },
    TeamMemberRole.MANAGER: {
        Permission.VIEW_LISTINGS: True,
        Permission.CREATE_LISTINGS: True,
        Permission.EDIT_LISTINGS: True,
        Permission.DELETE_LISTINGS: False,
        Permission.VIEW_TEAM: True,
        Permission.MANAGE_TEAM: True,
        Permission.VIEW_MESSAGES: True,
        Permission.SEND_MESSAGES: True,
        Permission.VIEW_ANALYTICS: True,
        Permission.MANAGE_BILLING: False,
    },
    TeamMemberRole.SALESPERSON: {
        Permission.VIEW_LISTINGS: True,
        Permission.CREATE_LISTINGS: True,
        Permission.EDIT_LISTINGS: True,
        Permission.DELETE_LISTINGS: False,
        Permission.VIEW_TEAM: False,
        Permission.MANAGE_TEAM: False,
        Permission.VIEW_MESSAGES: True,
        Permission.SEND_MESSAGES: True,
        Permission.VIEW_ANALYTICS: False,
        Permission.MANAGE_BILLING: False,
    },
    TeamMemberRole.VIEWER: {
        Permission.VIEW_LISTINGS: True,
        Permission.CREATE_LISTINGS: False,
        Permission.EDIT_LISTINGS: False,
        Permission.DELETE_LISTINGS: False,
        Permission.VIEW_TEAM: False,
        Permission.MANAGE_TEAM: False,
        Permission.VIEW_MESSAGES: True,
        Permission.SEND_MESSAGES: False,
        Permission.VIEW_ANALYTICS: False,
        Permission.MANAGE_BILLING: False,
    },
}


def _perms_from_dict(perms_dict: dict) -> Set[Permission]:
    """Convert a {key: bool} dict to a set of Permissions. Handles both
    'create_listings' and 'can_create_listings' key formats."""
    result: Set[Permission] = set()
    for perm_name, allowed in perms_dict.items():
        if allowed:
            try:
                # Strip leading 'can_' so both formats resolve to the enum value
                name = perm_name[4:] if perm_name.startswith("can_") else perm_name
                result.add(Permission(name))
            except ValueError:
                pass
    return result


def get_user_permissions(user: User) -> Set[Permission]:
    """Get all permissions for a user."""
    if user.user_type in ROLE_PERMISSIONS:
        return ROLE_PERMISSIONS[user.user_type]

    # Team members: custom per-user permissions take precedence over role defaults.
    if user.user_type == "team_member":
        if user.permissions:
            return _perms_from_dict(user.permissions)
        if user.role:
            try:
                role = TeamMemberRole(user.role)
                return {
                    perm
                    for perm, allowed in TEAM_ROLE_PERMISSIONS[role].items()
                    if allowed
                }
            except (ValueError, KeyError):
                pass

    # Fallback: check custom permissions for any other user type
    if user.permissions:
        return _perms_from_dict(user.permissions)

    return set()


def has_permission(user: User, permission: Permission) -> bool:
    """Check if a user has a specific permission"""
    user_perms = get_user_permissions(user)
    return permission in user_perms
