# Account Recovery & Soft Delete System

## Overview

YachtVersal now supports **soft delete** for user accounts with a **90-day recovery window**. This allows users, dealers, and admins to restore accidentally deleted accounts without permanently losing data.

### Key Features

- **Soft Delete**: Accounts are marked as deleted but retained in the database
- **90-Day Recovery Period**: Accounts can be restored within 90 days of deletion
- **Email Reuse**: Deleted emails can be reused after account deletion (not immediately recoverable)
- **Listing Preservation**: Listings are automatically reassigned when team members are removed
- **Admin Recovery**: Admins can restore any account during the recovery period
- **Permanent Deletion**: Accounts are automatically purged after 90 days (or manually by admin)

---

## Database Changes

### Migration: `004_soft_delete_users.py`

Added two columns to the `users` table:

```sql
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN recovery_deadline TIMESTAMP NULL;
```

#### Removed Constraints

- Removed `UNIQUE` constraint from `email` column
- Added partial unique index on email for **active users only**: `CREATE UNIQUE INDEX ix_users_email_active ON users(email) WHERE deleted_at IS NULL`

This allows:
- Active users must have unique emails
- Deleted users can have duplicate emails with other deleted users
- Deleted emails can be reused by new accounts

---

## User-Facing Endpoints

### Personal Account Recovery

#### 1. Delete Own Account

**Endpoint**: `DELETE /api/users/account/delete`

**Authentication**: Required (Bearer token)

**Request**: None

**Response**:
```json
{
    "success": true,
    "message": "Account deleted. You can restore it within 90 days.",
    "recovery_deadline": "2026-06-11T14:23:45.123456"
}
```

**Effect**: Sets `deleted_at` to current timestamp and `recovery_deadline` to 90 days from now.

---

#### 2. Restore Own Account

**Endpoint**: `POST /api/users/account/restore`

**Authentication**: Required

**Note**: User can restore their account even after logging out (verification link in email).

**Request**: None

**Response**:
```json
{
    "success": true,
    "message": "Account restored successfully"
}
```

**Effect**: Clears `deleted_at` and `recovery_deadline`.

---

#### 3. Check Account Deletion Status

**Endpoint**: `GET /api/users/account/deletion-status`

**Authentication**: Required

**Response** (Active Account):
```json
{
    "deleted": false,
    "message": "Account is active"
}
```

**Response** (Deleted Account):
```json
{
    "deleted": true,
    "deleted_at": "2026-03-11T14:23:45.123456",
    "recovery_deadline": "2026-06-11T14:23:45.123456",
    "recovery_expired": false,
    "days_remaining": 92
}
```

---

## Admin Endpoints

### 1. List Pending Recoveries

**Endpoint**: `GET /api/admin/users/recovery/pending`

**Authentication**: Admin only

**Response**:
```json
{
    "total": 2,
    "users": [
        {
            "id": 42,
            "email": "john@example.com",
            "first_name": "John",
            "last_name": "Smith",
            "company_name": "Smith Marine",
            "user_type": "dealer",
            "deleted_at": "2026-03-01T10:00:00",
            "recovery_deadline": "2026-06-01T10:00:00",
            "days_remaining": 82,
            "listings": 5
        }
    ]
}
```

---

### 2. Restore Deleted User

**Endpoint**: `POST /api/admin/users/{user_id}/recover`

**Authentication**: Admin only

**Request**: None

**Response**:
```json
{
    "success": true,
    "message": "User john@example.com has been restored",
    "user_id": 42,
    "email": "john@example.com"
}
```

**Error Cases**:
- User not found: `404 Not Found`
- User not deleted: `400 Bad Request`
- Recovery period expired: `400 Bad Request`

---

### 3. Check User Deletion Status (Admin)

**Endpoint**: `GET /api/admin/users/{user_id}/deletion-status`

**Authentication**: Admin only

**Response** (Active User):
```json
{
    "user_id": 42,
    "email": "john@example.com",
    "status": "active",
    "message": "Account is active"
}
```

**Response** (Recoverable):
```json
{
    "user_id": 42,
    "email": "john@example.com",
    "status": "deleted_recoverable",
    "deleted_at": "2026-03-01T10:00:00",
    "recovery_deadline": "2026-06-01T10:00:00",
    "days_remaining": 82,
    "can_restore": true,
    "can_permanently_delete": false
}
```

**Response** (Expired):
```json
{
    "user_id": 42,
    "email": "john@example.com",
    "status": "deleted_expired",
    "deleted_at": "2025-12-01T10:00:00",
    "recovery_deadline": "2026-03-01T10:00:00",
    "days_remaining": 0,
    "can_restore": false,
    "can_permanently_delete": true
}
```

---

### 4. Permanently Delete User

**Endpoint**: `POST /api/admin/users/{user_id}/permanent-delete`

**Authentication**: Admin only

**Request**:
```json
{
    "force": false  // Set to true to skip recovery period check
}
```

**Response**:
```json
{
    "success": true,
    "message": "User john@example.com permanently deleted with all associated data"
}
```

**Notes**:
- Cannot delete users with active recovery period unless `force=true`
- Deletion clears: user record, all listings, all related data
- This is irreversible

---

## Team Member Management

### Remove Team Member (Soft Delete)

**Endpoint**: `DELETE /api/team/members/{member_id}`

**Authentication**: Dealer only

**Response**:
```json
{
    "success": true,
    "message": "Team member removed. 5 listing(s) transferred to dealer.",
    "member_id": 15,
    "member_email": "sales-rep@example.com",
    "listings_transferred": 5,
    "recovery_deadline": "2026-06-11T14:23:45.123456",
    "note": "This team member can be recovered within 90 days via admin recovery endpoints."
}
```

**Effect**:
1. All listings owned by team member are transferred to the dealer
2. Team member is soft-deleted with 90-day recovery window
3. Email becomes available for new accounts immediately (if needed)

---

### Reassign Listings After Removal

#### Get Team Member Listings

**Endpoint**: `GET /api/team/members/{member_id}/listings`

**Authentication**: Dealer with Permission.MANAGE_TEAM

**Response**:
```json
{
    "member_id": 15,
    "member_name": "John Sales",
    "member_email": "sales-rep@example.com",
    "total_listings": 3,
    "listings": [
        {
            "id": 101,
            "title": "2024 Beneteau 36",
            "status": "active",
            "make_model": "Beneteau 36",
            "price": 250000,
            "created_at": "2026-02-15T10:00:00",
            "views": 245,
            "inquiries": 8
        }
    ]
}
```

---

#### Bulk Reassign Listings

**Endpoint**: `POST /api/team/members/{member_id}/bulk-reassign-listings`

**Authentication**: Dealer with Permission.MANAGE_TEAM

**Request**:
```json
{
    "new_owner_id": 20  // Can be dealer or another team member
}
```

**Response**:
```json
{
    "success": true,
    "member_id": 15,
    "member_name": "John Sales",
    "new_owner_id": 20,
    "new_owner_name": "Jane Manager",
    "listings_reassigned": 5,
    "message": "5 listing(s) reassigned from John Sales to Jane Manager"
}
```

---

#### Reassign Individual Listing

**Endpoint**: `PUT /api/team/listings/{listing_id}/reassign-owner`

**Authentication**: Current owner or dealer

**Request**:
```json
{
    "new_owner_id": 20
}
```

**Response**:
```json
{
    "success": true,
    "listing_id": 101,
    "listing_title": "2024 Beneteau 36",
    "old_owner_id": 15,
    "new_owner_id": 20,
    "new_owner_name": "Jane Manager",
    "message": "Listing reassigned to Jane Manager"
}
```

---

## Bug Fixes

### Issue: Can't Reuse Email After Deletion

**Problem**: After deleting a user account, attempting to register with the same email failed with "Email already registered" error.

**Fix**: 
- Email uniqueness constraint moved from database level to application level
- New uniqueness check: `SELECT id FROM users WHERE email = :email AND deleted_at IS NULL`
- Soft-deleted users are no longer checked when validating new registrations
- Database index created on `(email, deleted_at)` for performance

### Issue: Same Email for Multiple Account Types

**Behavior**: By design, only **active** accounts must have unique emails. This allows:
- User can delete their account and create a new one with same email
- User can have different account types (dealer + private seller) by using different emails OR recovering after deletion

If you want to support same email for multiple account types simultaneously, you would need to:
1. Add an `account_type` field to the email uniqueness constraint
2. Use partial unique index: `CREATE UNIQUE INDEX ix_users_email_type ON users(email, user_type) WHERE deleted_at IS NULL`

---

## Recovery Workflow Examples

### Scenario 1: User Accidentally Deletes Their Account

1. User REST calls `DELETE /api/users/account/delete`
2. Account is marked deleted with 90-day recovery window
3. User can call `POST /api/users/account/restore` anytime within 90 days
4. After 90 days, admin must manually delete if needed

### Scenario 2: Dealer Removes Sales Rep

1. Dealer calls `DELETE /api/team/members/{rep_id}`
2. All rep's listings transferred to dealer
3. Rep's account soft-deleted for 90 days
4. During recovery period, admin can restore the rep account
5. Once restored, rep can access their account and request listing reassignment

### Scenario 3: Admin Manages Expired Accounts

1. Cron job or manual admin review identifies expired accounts
2. Admin calls `POST /api/admin/users/{user_id}/permanent-delete`
3. Account and all data permanently removed
4. Email becomes available forever (no soft-deleted record)

---

## Configuration

### Recovery Window

**Default**: 90 days

To change, modify in future versions by parameterizing:

```python
ACCOUNT_RECOVERY_DAYS = int(os.getenv("ACCOUNT_RECOVERY_DAYS", "90"))
recovery_deadline = datetime.utcnow() + timedelta(days=ACCOUNT_RECOVERY_DAYS)
```

---

## Data Privacy & Compliance

### GDPR Considerations

- **Purpose**: Soft delete allows 90-day recovery for user convenience
- **Right to be Forgotten**: Admins can force permanent deletion with `force=true` parameter
- **Audit Trail**: `deleted_at` timestamp provides proof of deletion
- **Data Minimization**: After 90 days, permanent deletion removes all PII

### Automatic Cleanup

To implement automatic cleanup after 90 days, create a background job:

```python
@router.post("/admin/scheduled-cleanup")
async def cleanup_expired_accounts(background_tasks: BackgroundTasks):
    """Schedule cleanup of expired accounts."""
    background_tasks.add_task(cleanup_expired_users)

async def cleanup_expired_users():
    from datetime import datetime, timedelta
    
    now = datetime.utcnow()
    expired = db.query(User).filter(
        User.deleted_at.isnot(None),
        User.recovery_deadline < now
    ).all()
    
    for user in expired:
        # Hard delete
        db.delete(user)
    
    db.commit()
    logger.info(f"Cleanup: {len(expired)} expired accounts deleted")
```

---

## Testing

### Manual Testing Steps

1. **Create a test user**: Register with `test@example.com`
2. **Delete account**: `DELETE /api/users/account/delete`
3. **Try registering again**: Should succeed with same email
4. **Restore**:  `POST /api/users/account/restore` (if within 90 days)
5. **Verify active**: `GET /api/users/account/deletion-status` should show `deleted: false`

### Admin Testing

```bash
# List pending recoveries
curl -H "Authorization: Bearer {admin_token}" \
  http://localhost:8000/api/admin/users/recovery/pending

# Check specific user status
curl -H "Authorization: Bearer {admin_token}" \
  http://localhost:8000/api/admin/users/42/deletion-status

# Restore user
curl -X POST -H "Authorization: Bearer {admin_token}" \
  http://localhost:8000/api/admin/users/42/recover
```

---

## Migration Guide

### Before Deploying

1. **Backup database** (in case of migration issues)
2. **Run migration**: `alembic upgrade head`
3. **Verify migration**: Check that `deleted_at` and `recovery_deadline` columns exist
4. **Test with non-production data first**

### If Migration Fails

Downgrade with:
```bash
alembic downgrade -1
```

This will:
- Drop `deleted_at` and `recovery_deadline` columns
- Drop partial unique index on email
- Attempt to restore original unique constraint (may fail on SQLite if records have duplicate emails)

---

## Future Enhancements

1. **Soft Delete for Other Resources**: Extend soft delete to listings, media, messages
2. **Audit Log**: Track all deletion/restoration events
3. **Email Notifications**: Send warnings before permanent deletion
4. **Bulk Recovery**: Admin dashboard to restore multiple accounts
5. **Recovery Request UI**: Users can request restore via email link
6. **Account Transfer**: Transfer account to new email before permanent deletion

---

## Support

For issues or questions about account recovery:
- Email: `support@yachtversal.com`
- Slack: `#backend-issues`
- Check logs: `GET /api/admin/logs?search=recovery`
