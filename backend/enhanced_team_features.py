from fastapi import Depends, HTTPException 
from sqlalchemy.orm import Session 
from enum import Enum 
from typing import List

from main import app, get_db, get_current_user
from main import User, Listing, Inquiry
from email_service import email_service


# ============================================
# 2. ENHANCED TEAM ROLES & PERMISSIONS
# ============================================

class TeamRole(str, Enum):
    """Team member role types"""
    OWNER = "owner"              # Full access
    MANAGER = "manager"          # Almost full access
    SALES_MANAGER = "sales_manager"  # Manage team + own listings
    SALESPERSON = "salesperson"  # Own listings only
    VIEWER = "viewer"            # Read-only

# Permission templates for each role
TEAM_ROLE_PERMISSIONS = {
    TeamRole.OWNER: {
        # Listings
        "can_create_listings": True,
        "can_edit_own_listings": True,
        "can_edit_all_listings": True,
        "can_delete_own_listings": True,
        "can_delete_all_listings": True,
        "can_publish_listings": True,
        
        # Inquiries & Messages
        "can_view_own_inquiries": True,
        "can_view_all_inquiries": True,
        "can_respond_to_inquiries": True,
        
        # Team
        "can_manage_team": True,
        "can_invite_members": True,
        "can_remove_members": True,
        "can_modify_permissions": True,
        
        # Analytics & Settings
        "can_view_own_analytics": True,
        "can_view_company_analytics": True,
        "can_customize_dealer_page": True,
        "can_manage_billing": True,
        
        # Notifications
        "email_new_message": True,
        "email_new_inquiry": True,
        "email_listing_published": True,
        "email_team_activity": True,
    },
    
    TeamRole.MANAGER: {
        "can_create_listings": True,
        "can_edit_own_listings": True,
        "can_edit_all_listings": True,
        "can_delete_own_listings": True,
        "can_delete_all_listings": False,  # Can't delete others'
        "can_publish_listings": True,
        
        "can_view_own_inquiries": True,
        "can_view_all_inquiries": True,
        "can_respond_to_inquiries": True,
        
        "can_manage_team": True,
        "can_invite_members": True,
        "can_remove_members": False,  # Can't remove
        "can_modify_permissions": False,
        
        "can_view_own_analytics": True,
        "can_view_company_analytics": True,
        "can_customize_dealer_page": False,
        "can_manage_billing": False,
        
        "email_new_message": True,
        "email_new_inquiry": True,
        "email_listing_published": True,
        "email_team_activity": True,
    },
    
    TeamRole.SALES_MANAGER: {
        "can_create_listings": True,
        "can_edit_own_listings": True,
        "can_edit_all_listings": False,
        "can_delete_own_listings": True,
        "can_delete_all_listings": False,
        "can_publish_listings": True,
        
        "can_view_own_inquiries": True,
        "can_view_all_inquiries": False,  # Only their own
        "can_respond_to_inquiries": True,
        
        "can_manage_team": True,
        "can_invite_members": True,
        "can_remove_members": False,
        "can_modify_permissions": False,
        
        "can_view_own_analytics": True,
        "can_view_company_analytics": False,
        "can_customize_dealer_page": False,
        "can_manage_billing": False,
        
        "email_new_message": True,
        "email_new_inquiry": True,
        "email_listing_published": True,
        "email_team_activity": False,
    },
    
    TeamRole.SALESPERSON: {
        "can_create_listings": True,
        "can_edit_own_listings": True,
        "can_edit_all_listings": False,
        "can_delete_own_listings": True,
        "can_delete_all_listings": False,
        "can_publish_listings": True,
        
        "can_view_own_inquiries": True,
        "can_view_all_inquiries": False,
        "can_respond_to_inquiries": True,
        
        "can_manage_team": False,
        "can_invite_members": False,
        "can_remove_members": False,
        "can_modify_permissions": False,
        
        "can_view_own_analytics": True,
        "can_view_company_analytics": False,
        "can_customize_dealer_page": False,
        "can_manage_billing": False,
        
        "email_new_message": True,
        "email_new_inquiry": True,
        "email_listing_published": False,
        "email_team_activity": False,
    },
    
    TeamRole.VIEWER: {
        "can_create_listings": False,
        "can_edit_own_listings": False,
        "can_edit_all_listings": False,
        "can_delete_own_listings": False,
        "can_delete_all_listings": False,
        "can_publish_listings": False,
        
        "can_view_own_inquiries": True,
        "can_view_all_inquiries": True,  # Can view but not respond
        "can_respond_to_inquiries": False,
        
        "can_manage_team": False,
        "can_invite_members": False,
        "can_remove_members": False,
        "can_modify_permissions": False,
        
        "can_view_own_analytics": True,
        "can_view_company_analytics": True,
        "can_customize_dealer_page": False,
        "can_manage_billing": False,
        
        "email_new_message": True,
        "email_new_inquiry": False,
        "email_listing_published": False,
        "email_team_activity": False,
    },
}


# ============================================
# 3. PERMISSION CHECKING HELPERS
# ============================================

def get_dealer_id(user: User) -> int:
    """Get the dealer ID for a user (parent dealer if team member)"""
    return user.parent_dealer_id if user.parent_dealer_id else user.id


def can_access_listing(user: User, listing: 'Listing', action: str) -> bool:
    """
    Check if user can perform action on listing
    
    Args:
        user: Current user
        listing: Listing to check
        action: "view", "edit", "delete", "publish"
    
    Returns:
        bool: Whether user has permission
    """
    # Admins can do anything
    if user.user_type == "admin":
        return True
    
    # Sales reps can only view their assigned dealers' listings
    if user.user_type == "salesman":
        listing_owner = listing.owner
        return listing_owner.assigned_sales_rep_id == user.id if action == "view" else False
    
    # Buyers can only view
    if user.user_type == "buyer":
        return action == "view" and listing.status == "active"
    
    # Check if listing belongs to user's company
    dealer_id = get_dealer_id(user)
    if listing.user_id != dealer_id:
        return False
    
    # Check specific permissions
    is_creator = listing.created_by_user_id == user.id
    perms = user.permissions or {}
    
    if action == "view":
        return True
    elif action == "edit":
        if is_creator and perms.get("can_edit_own_listings", True):
            return True
        return perms.get("can_edit_all_listings", False)
    elif action == "delete":
        if is_creator and perms.get("can_delete_own_listings", False):
            return True
        return perms.get("can_delete_all_listings", False)
    elif action == "publish":
        return perms.get("can_publish_listings", True)
    
    return False


def can_access_inquiry(user: User, inquiry: 'Inquiry') -> bool:
    """Check if user can access an inquiry"""
    # Admins can see all
    if user.user_type == "admin":
        return True
    
    listing = inquiry.listing
    if not listing:
        return False
    
    # Sales reps can see inquiries for their dealers
    if user.user_type == "salesman":
        return listing.owner.assigned_sales_rep_id == user.id
    
    # Buyers can see their own sent inquiries
    if user.user_type == "buyer":
        return inquiry.sender_email == user.email
    
    # Check if inquiry is for user's company
    dealer_id = get_dealer_id(user)
    if listing.user_id != dealer_id:
        return False
    
    # Team members - check permissions
    perms = user.permissions or {}
    
    # Can always see own inquiries
    if listing.created_by_user_id == user.id:
        return perms.get("can_view_own_inquiries", True)
    
    # Check if can see all company inquiries
    return perms.get("can_view_all_inquiries", False)


def get_message_access_level(user: User) -> List[str]:
    """
    Get message access levels for user
    
    Returns:
        List of user IDs that messages should be visible to
    """
    access = [user.id]  # Always see own messages
    
    if user.user_type == "admin":
        # Admins see everything - return special marker
        return ["*"]
    
    if user.user_type == "salesman":
        # Sales reps see their dealers' messages
        dealers = db.query(User).filter(
            User.assigned_sales_rep_id == user.id
        ).all()
        access.extend([d.id for d in dealers])
    
    if user.parent_dealer_id:
        # Team members - parent dealer can see if can_view_all_inquiries
        parent = db.query(User).filter(User.id == user.parent_dealer_id).first()
        if parent:
            access.append(parent.id)
    
    # If dealer, see team members' messages if they have permission
    team_members = db.query(User).filter(
        User.parent_dealer_id == user.id
    ).all()
    access.extend([tm.id for tm in team_members])
    
    return access


# ============================================
# 4. ENHANCED ENDPOINTS
# ============================================

@app.post("/api/team/members/invite")
def invite_team_member(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Enhanced team member invitation with role templates"""
    
    # Check permission
    perms = current_user.permissions or {}
    if not perms.get("can_invite_members", False):
        raise AuthorizationException("No permission to invite team members")
    
    # Validate email
    email = data.get("email")
    if db.query(User).filter(User.email == email).first():
        raise ValidationException("User with this email already exists")
    
    # Get role and apply permission template
    role = data.get("role", TeamRole.SALESPERSON)
    if role not in TEAM_ROLE_PERMISSIONS:
        role = TeamRole.SALESPERSON
    
    permissions = TEAM_ROLE_PERMISSIONS[role].copy()
    
    # Allow custom overrides
    if "custom_permissions" in data:
        permissions.update(data["custom_permissions"])
    
    # Generate secure password
    temp_password = secrets.token_urlsafe(16)
    
    # Create team member
    dealer_id = get_dealer_id(current_user)
    team_member = User(
        email=email,
        password_hash=get_password_hash(temp_password),
        first_name=data.get("first_name"),
        last_name=data.get("last_name"),
        phone=data.get("phone"),
        user_type="team_member",
        parent_dealer_id=dealer_id,
        role=role,
        permissions=permissions,
        subscription_tier=current_user.subscription_tier,
        
        # Public profile settings
        public_profile=data.get("public_profile", False),
        title=data.get("title"),
        bio=data.get("bio"),
        specialties=data.get("specialties", []),
    )
    
    db.add(team_member)
    db.commit()
    db.refresh(team_member)
    
    # Send invitation email
    dealer = db.query(User).filter(User.id == dealer_id).first()
    email_service.send_email(
        to_email=email,
        subject="Team Invitation - YachtVersal",
        html_content=f"""
        <h2>Welcome to the Team!</h2>
        <p>You've been invited by <strong>{dealer.company_name or dealer.email}</strong> 
        to join their yacht dealership team on YachtVersal.</p>
        
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Your Role:</strong> {role}</p>
            <p><strong>Email:</strong> {email}</p>
            <p><strong>Temporary Password:</strong> <code>{temp_password}</code></p>
        </div>
        
        <p><strong>⚠️ Important:</strong> Please change your password immediately after logging in.</p>
        
        <a href="https://yachtversal.com/login" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0;">
            Log In Now
        </a>
        
        <h3>Your Permissions:</h3>
        <ul>
            <li>✓ Create listings: {permissions.get("can_create_listings", False)}</li>
            <li>✓ Edit all listings: {permissions.get("can_edit_all_listings", False)}</li>
            <li>✓ View all inquiries: {permissions.get("can_view_all_inquiries", False)}</li>
            <li>✓ Manage team: {permissions.get("can_manage_team", False)}</li>
            <li>✓ View analytics: {permissions.get("can_view_company_analytics", False)}</li>
        </ul>
        """
    )
    
    return {
        "success": True,
        "member_id": team_member.id,
        "temporary_password": temp_password,
        "role": role,
        "permissions": permissions
    }


@app.get("/api/team/members/{member_id}/profile")
def get_team_member_profile(
    member_id: int,
    db: Session = Depends(get_db)
):
    """Get public team member profile (for dealer pages)"""
    
    member = db.query(User).filter(
        User.id == member_id,
        User.public_profile == True
    ).first()
    
    if not member:
        raise ResourceNotFoundException("Team member profile not found")
    
    # Get their listing count
    listing_count = db.query(Listing).filter(
        Listing.created_by_user_id == member_id,
        Listing.status == "active"
    ).count()
    
    return {
        "id": member.id,
        "name": f"{member.first_name} {member.last_name}",
        "title": member.title,
        "bio": member.bio,
        "photo_url": member.profile_photo_url,
        "email": member.email,
        "phone": member.phone,
        "specialties": member.specialties,
        "listing_count": listing_count,
    }


@app.put("/api/team/members/{member_id}/profile")
def update_team_member_profile(
    member_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update team member public profile"""
    
    # Can only update own profile or if have permission
    member = db.query(User).filter(User.id == member_id).first()
    if not member:
        raise ResourceNotFoundException("Team member not found")
    
    dealer_id = get_dealer_id(current_user)
    is_own_profile = member.id == current_user.id
    is_manager = current_user.permissions.get("can_manage_team", False)
    
    if not (is_own_profile or is_manager or member.parent_dealer_id == dealer_id):
        raise AuthorizationException("No permission to update this profile")
    
    # Update profile fields
    if "public_profile" in data:
        member.public_profile = data["public_profile"]
    if "profile_photo_url" in data:
        member.profile_photo_url = data["profile_photo_url"]
    if "bio" in data:
        member.bio = data["bio"]
    if "title" in data:
        member.title = data["title"]
    if "specialties" in data:
        member.specialties = data["specialties"]
    
    db.commit()
    
    return {"success": True}


@app.get("/api/dealers/{slug}/team")
def get_dealer_team_public(slug: str, db: Session = Depends(get_db)):
    """Get dealer's public team members (for dealer page)"""
    
    dealer = db.query(DealerProfile).filter(
        DealerProfile.slug == slug,
        DealerProfile.active == True
    ).first()
    
    if not dealer:
        raise ResourceNotFoundException("Dealer not found")
    
    # Get team members with public profiles
    team_members = db.query(User).filter(
        User.parent_dealer_id == dealer.user_id,
        User.public_profile == True,
        User.active == True
    ).all()
    
    result = []
    for member in team_members:
        # Get their listings
        listings = db.query(Listing).filter(
            Listing.created_by_user_id == member.id,
            Listing.status == "active"
        ).all()
        
        result.append({
            "id": member.id,
            "name": f"{member.first_name} {member.last_name}",
            "title": member.title,
            "bio": member.bio,
            "photo_url": member.profile_photo_url,
            "email": member.email,
            "phone": member.phone,
            "specialties": member.specialties,
            "listing_count": len(listings),
            "featured_listings": [
                {
                    "id": l.id,
                    "title": l.title,
                    "price": l.price,
                    "images": [{"url": img.url} for img in l.images[:1]]
                }
                for l in listings[:3]  # Show up to 3 featured
            ]
        })
    
    return result


@app.put("/api/user/notification-preferences")
def update_notification_preferences(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update notification preferences"""
    
    # Get current permissions
    permissions = current_user.permissions or {}
    
    # Update notification settings
    notification_keys = [
        "email_new_message",
        "email_new_inquiry",
        "email_listing_published",
        "email_team_activity",
        "email_dealer_updates",
        "email_price_alert",
        "email_new_listing_match",
        "email_marketing"
    ]
    
    for key in notification_keys:
        if key in data:
            permissions[key] = data[key]
    
    current_user.permissions = permissions
    db.commit()
    
    return {
        "success": True,
        "preferences": {k: permissions.get(k, True) for k in notification_keys}
    }


@app.get("/api/admin/sales-reps")
def get_sales_reps(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin: Get all sales reps with their assigned dealers"""
    
    if current_user.user_type != "admin":
        raise AuthorizationException("Admin access required")
    
    sales_reps = db.query(User).filter(User.user_type == "salesman").all()
    
    result = []
    for rep in sales_reps:
        # Get assigned dealers
        dealers = db.query(User).filter(
            User.assigned_sales_rep_id == rep.id
        ).all()
        
        # Calculate commission
        total_revenue = sum(
            TIER_PRICES.get(d.subscription_tier, 0) 
            for d in dealers 
            if d.active
        )
        commission = total_revenue * 0.10
        
        result.append({
            "id": rep.id,
            "name": f"{rep.first_name} {rep.last_name}",
            "email": rep.email,
            "dealer_count": len(dealers),
            "active_dealers": len([d for d in dealers if d.active]),
            "monthly_commission": commission,
            "total_revenue": total_revenue,
        })
    
    return result