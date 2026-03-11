# Demo Account System for Sales Team

## Overview

Per-sales-rep demo dealer accounts allow your sales team to showcase YachtVersal features with a fully functional, pre-populated dealer dashboard.

**Key Features:**
- ✅ Each sales rep gets an isolated demo dealer account
- ✅ Auto-populated with 8 sample yacht listings (various types & price ranges)
- ✅ Sales reps login via dashboard with one-click access
- ✅ Admin can reset demo accounts to pristine state
- ✅ Unlimited features (demo subscription tier)

---

## Admin Setup

### 1. Create a Demo Account for a Sales Rep

**Endpoint:** `POST /api/admin/demo-account/create`

**Request:**
```json
{
  "sales_rep_id": 42
}
```

**Response:**
```json
{
  "success": true,
  "demo_account": {
    "id": 123,
    "email": "demo-42-abc12345@yachtversal.demo",
    "password": "generated_secure_password_here",
    "first_name": "Demo - John",
    "last_name": "Smith",
    "company_name": "[DEMO] John's Demo",
    "is_demo": true
  },
  "sales_rep_id": 42,
  "listings_created": 8,
  "message": "Demo account created with 8 sample listings. Share the email and password with the sales rep.",
  "note": "This is a test account. The password is provided above — save it securely."
}
```

**Save the credentials** for sharing with the sales rep.

---

### 2. View All Demo Accounts

**Endpoint:** `GET /api/admin/demo-accounts`

**Example Response:**
```json
{
  "total": 3,
  "demo_accounts": [
    {
      "id": 123,
      "email": "demo-42-abc12345@yachtversal.demo",
      "company_name": "[DEMO] John's Demo",
      "sales_rep_id": 42,
      "sales_rep_name": "John Smith",
      "listings": 8,
      "created_at": "2026-03-11T10:00:00"
    }
  ]
}
```

---

### 3. Get Demo Account Info for a Specific Sales Rep

**Endpoint:** `GET /api/admin/demo-account/{sales_rep_id}`

Example: `GET /api/admin/demo-account/42`

---

### 4. Reset a Demo Account (Clear Messages, Restore Listings)

**Endpoint:** `POST /api/admin/demo-account/{demo_account_id}/reset`

**Response:**
```json
{
  "success": true,
  "demo_account_id": 123,
  "email": "demo-42-abc12345@yachtversal.demo",
  "listings_restored": 8,
  "message": "Demo account reset to pristine state"
}
```

This will:
- ✅ Delete all inquiries/messages
- ✅ Delete all modified listings
- ✅ Restore the 8 original sample listings with fresh data

---

### 5. Delete a Demo Account

**Endpoint:** `DELETE /api/admin/demo-account/{demo_account_id}`

Permanently removes the demo account and all associated data.

---

## Sales Rep Access

### 1. Check if Demo Account Exists

Sales reps can check their demo account status:

**Endpoint:** `GET /auth/demo/info` (requires sales rep authentication)

**Response if demo exists:**
```json
{
  "has_demo_account": true,
  "demo_account": {
    "id": 123,
    "email": "demo-42-abc12345@yachtversal.demo",
    "company_name": "[DEMO] John's Demo",
    "listings": 8,
    "inquiries": 0
  },
  "message": "Demo account ready. Use /auth/demo/access to get login token."
}
```

**Response if no demo account:**
```json
{
  "has_demo_account": false,
  "message": "No demo account assigned. Contact an administrator."
}
```

---

### 2. Access Demo Account

Sales reps can request a temporary access token for their demo account:

**Endpoint:** `POST /auth/demo/access` (requires sales rep authentication)

**Response:**
```json
{
  "success": true,
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "demo_account": {
    "id": 123,
    "email": "demo-42-abc12345@yachtversal.demo",
    "company_name": "[DEMO] John's Demo",
    "listings": 8
  },
  "message": "Use this token to access the demo account dashboard"
}
```

---

### 3. Dashboard Workflow

**For Sales Reps:**

1. Log in to their own sales rep account (`user_type: salesman`)
2. Go to Dashboard → Demo Account section (or click "Demo Showroom")
3. Click "Access Demo" button
4. System calls `POST /auth/demo/access` endpoint
5. Receive bearer token
6. Redirect to dealer dashboard while logged in as demo account
7. Show off all features: listings, inquiries, messages, analytics, etc.

---

## Sample Listings

The system auto-populates demo accounts with 8 pre-configured yacht listings:

| Listing | Make/Model | Type | Price | Year |
|---------|-----------|------|-------|------|
| 1 | Azimut 55 | Motor Yacht | $2.5M | 2024 |
| 2 | Sunseeker 76 | Express Cruiser | $3.8M | 2022 |
| 3 | Lagoon 450 | Sailing Catamaran | $850K | 2021 |
| 4 | Sea Ray 460 | Motor Yacht | $1.2M | 2019 |
| 5 | Jeanneau 64 | Sailing Yacht | $2.2M | 2023 |
| 6 | Swift Trawler 50 | Trawler | $980K | 2020 |
| 7 | Princess 68 | Motor Yacht | $4.5M | 2023 |
| 8 | Zodiac Yachtline 480 | Rigid Inflatable | $450K | 2018 |

Each includes:
- ✅ Full specifications (length, beam, capacity, etc.)
- ✅ Rich descriptions
- ✅ Boat type and condition info
- ✅ Features list
- ✅ Location and pricing

---

## Typical Admin Workflow

```
1. Add a new sales rep to the system
   → POST /api/users (or invite via team management)

2. Create a demo account for them
   → POST /api/admin/demo-account/create { sales_rep_id: X }

3. Share credentials via email or Slack
   → Email: demo-X-XXXX@yachtversal.demo
   → Password: xxxxxxxxxxxxxxx

4. Sales rep tests it out

5. If issues arise or they want a clean slate
   → POST /api/admin/demo-account/{id}/reset

6. If they leave or no longer need it
   → DELETE /api/admin/demo-account/{id}
```

---

## Testing Demonstration Scenarios

### Scenario 1: Showcase Search & Filters
- Have potential clients search for listings by price range, location, boat type
- Show how advanced filters narrow results
- Demo map view

### Scenario 2: Show Inquiry Management
- Manually create test inquiries (or have a team member submit one)
- Show how dealer views all inquiries in one place
- Demo response messaging system

### Scenario 3: Analytics & Performance
- Show listing traffic and inquiry trends
- Demo the performance dashboard
- Display team member activity (if applicable)

### Scenario 4: Listing Creation & Management
- Create a new listing from scratch
- Upload photos (use demo photo URLs)
- Show editing and draft features
- Publish and track performance

### Scenario 5: Admin Features (if accessed as admin)
- Show webhook configuration
- Demo API key management
- Display billing/subscription info

---

## Database Fields

### User Model Updates
```python
is_demo: Boolean  # Marks as demo account
demo_owner_sales_rep_id: Integer FK → User.id  # Links to sales rep
```

### Demo Account Identifiers
- Email format: `demo-{sales_rep_id}-{random}@yachtversal.demo`
- Subscription tier: `"demo"` (unlimited features)
- Company name: `[DEMO] {Sales Rep Name}'s Demo`

---

## Database Cleanup (After Migration)

After running `alembic upgrade head`:

1. Demo accounts are fully functional
2. No cleanup needed — system auto-manages
3. Old demo accounts can be manually deleted via admin API if needed

---

## API Summary

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/admin/demo-account/create` | POST | Admin | Create demo account |
| `/api/admin/demo-accounts` | GET | Admin | List all demo accounts |
| `/api/admin/demo-account/{sales_rep_id}` | GET | Admin | Get demo by sales rep ID |
| `/api/admin/demo-account/{id}/reset` | POST | Admin | Clear & restore sample data |
| `/api/admin/demo-account/{id}` | DELETE | Admin | Delete demo account |
| `/auth/demo/info` | GET | Sales Rep | Check demo existence |
| `/auth/demo/access` | POST | Sales Rep | Get login token |

---

## Future Enhancements

- [ ] Dashboard UI "One-Click Demo" button
- [ ] Pre-recorded demo scenarios (videos/walkthroughs)
- [ ] Test WebHook endpoint for demo accounts
- [ ] Automated clean-up of stale demo accounts
- [ ] Demo account expiration dates
- [ ] Multi-language demo listings

---

## Troubleshooting

**Q: Demo account doesn't exist for a sales rep**
- A: Admin needs to create one via `POST /api/admin/demo-account/create`

**Q: Access token expired**
- A: Request a new token via `POST /auth/demo/access`

**Q: Want a fresh start**
- A: Admin calls `POST /api/admin/demo-account/{id}/reset` to restore pristine state

**Q: Sales rep forgot the credentials**
- A: Admin can check via `GET /api/admin/demo-account/{sales_rep_id}` (email is visible), password is in original response

---

## Security Notes

- ✅ Demo accounts use `.demo` domain to clearly mark them as non-production
- ✅ Demo tier has unlimited features (for showcasing)
- ✅ Demo accounts isolated from real dealer data
- ✅ Password generated at creation — can't be recovered
- ✅ Admin audit trail for all demo account actions (logs each call)

