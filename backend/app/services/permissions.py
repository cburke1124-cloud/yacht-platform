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
    
    # Team member permissions vary by role
    "team_member": {
        Permission.VIEW_LISTINGS,
        Permission.VIEW_MESSAGES,
    },
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


def get_user_permissions(user: User) -> Set[Permission]:
    """Get all permissions for a user"""
    if user.user_type in ROLE_PERMISSIONS:
        return ROLE_PERMISSIONS[user.user_type]
    
    # For team members, check their role
    if user.user_type == "team_member" and user.role:
        try:
            role = TeamMemberRole(user.role)
            return {
                perm for perm, allowed in TEAM_ROLE_PERMISSIONS[role].items()
                if allowed
            }
        except (ValueError, KeyError):
            pass
    
    # Check custom permissions
    if user.permissions:
        custom_perms = set()
        for perm_name, allowed in user.permissions.items():
            if allowed:
                try:
                    custom_perms.add(Permission(perm_name))
                except ValueError:
                    pass
        return custom_perms
    
    return set()


def has_permission(user: User, permission: Permission) -> bool:
    """Check if a user has a specific permission"""
    user_perms = get_user_permissions(user)
    return permission in user_perms
