# Documentation System Guide

## Overview

YachtVersal now has an **admin-editable documentation system** that makes it easy to create, update, and share guides with your team.

**Key Features:**
- ✅ Admin can create/edit documentation in real-time (no code changes needed)
- ✅ Role-based access control (admin-only docs, sales rep docs, public docs)
- ✅ Markdown-formatted content
- ✅ Categorized by topic (demo, sales, admin, api, etc.)
- ✅ Pre-seeded with demo account guide + sales guide
- ✅ Sales reps can access guides from their dashboard

---

## Admin Management

### 1. Initialize Default Documentation

When you first deploy, run this to seed the default guides:

**Endpoint:** `POST /api/admin/docs/init-defaults`

**Response:**
```json
{
  "success": true,
  "created": ["demo-account-guide", "sales-guide"],
  "skipped": [],
  "message": "Initialized 2 default documentation(s)"
}
```

This creates:
- Demo Account Guide (for sales reps)
- Sales Guide (company info, features, pitch templates)

### 2. List All Documentation

**Endpoint:** `GET /api/admin/docs?category=sales&published_only=true`

**Query Parameters:**
- `category` - Filter by: demo, sales, admin, api, general
- `audience` - Filter by: all, admin, sales_rep, dealer, public
- `published_only` - Default: true

**Response:**
```json
{
  "total": 5,
  "docs": [
    {
      "id": 1,
      "slug": "demo-account-guide",
      "title": "Demo Account Guide",
      "description": "How to access and use your demo dealer account",
      "category": "demo",
      "audience": "sales_rep",
      "order": 1,
      "published": true,
      "updated_at": "2026-03-11T10:00:00"
    }
  ]
}
```

### 3. Create New Documentation

**Endpoint:** `POST /api/admin/docs`

**Request:**
```json
{
  "slug": "training-manual",
  "title": "Sales Training Manual",
  "description": "Complete training for new sales reps",
  "category": "sales",
  "audience": "sales_rep",
  "order": 5,
  "content": "# Sales Training\n\n## Module 1...",
  "published": true
}
```

**Required Fields:**
- `slug` - URL-friendly identifier (lowercase, hyphens only)
- `title` - Display name
- `content` - Full markdown content

**Optional Fields:**
- `description` - Short summary
- `category` - Grouping: demo, sales, admin, api, general
- `audience` - Who can see: all, admin, sales_rep, dealer, public
- `order` - Sort order within category
- `published` - Visible to users?

**Response:**
```json
{
  "success": true,
  "id": 5,
  "slug": "training-manual",
  "title": "Sales Training Manual",
  "message": "Documentation created"
}
```

### 4. View Documentation (Admin)

**Endpoint:** `GET /api/admin/docs/{slug}`

Example: `GET /api/admin/docs/demo-account-guide`

**Response includes full content:**
```json
{
  "id": 1,
  "slug": "demo-account-guide",
  "title": "Demo Account Guide",
  "description": "...",
  "content": "# Demo Account Guide for Sales Reps\n\n## Overview\n...",
  "category": "demo",
  "audience": "sales_rep",
  "order": 1,
  "published": true,
  "created_at": "2026-03-11T10:00:00",
  "updated_at": "2026-03-11T10:00:00",
  "updated_by_user_id": 1
}
```

### 5. Update Documentation

**Endpoint:** `PUT /api/admin/docs/{slug}`

Example: `PUT /api/admin/docs/demo-account-guide`

**Request (partial update OK):**
```json
{
  "title": "Updated Demo Account Guide",
  "content": "# Updated content...",
  "published": true
}
```

**Response:**
```json
{
  "success": true,
  "slug": "demo-account-guide",
  "title": "Updated Demo Account Guide",
  "message": "Documentation updated"
}
```

### 6. Delete Documentation

**Endpoint:** `DELETE /api/admin/docs/{slug}`

Example: `DELETE /api/admin/docs/old-guide`

**Response:**
```json
{
  "success": true,
  "message": "Documentation deleted"
}
```

---

## Sales Rep Access

### 1. List Available Guides

Sales reps can see docs intended for their audience:

**Endpoint:** `GET /auth/docs` (requires authentication)

**Response:**
```json
{
  "total": 3,
  "by_category": {
    "demo": [
      {
        "slug": "demo-account-guide",
        "title": "Demo Account Guide",
        "description": "How to access your demo..."
      }
    ],
    "sales": [
      {
        "slug": "sales-guide",
        "title": "YachtVersal Sales Guide",
        "description": "Company overview and sales pitch..."
      }
    ]
  },
  "docs": [...]
}
```

### 2. Read a Guide

**Endpoint:** `GET /auth/docs/{slug}` (requires authentication)

Example: `GET /auth/docs/demo-account-guide`

**Response:**
```json
{
  "slug": "demo-account-guide",
  "title": "Demo Account Guide",
  "description": "How to access and use your demo dealer account",
  "category": "demo",
  "content": "# Demo Account Guide for Sales Reps\n\n## Overview\n...[full markdown content]...",
  "updated_at": "2026-03-11T10:00:00"
}
```

---

## Public Access (No Authentication)

Documentation with `audience: "public"` can be viewed without logging in:

**Endpoint:** `GET /auth/docs/{slug}` (no auth required)

Example: `GET /auth/docs/company-overview`

---

## Role-Based Audience Control

| Audience | Who Can See | Use For |
|----------|-------------|---------|
| `all` | Everyone | General info, FAQs |
| `public` | Anyone (no login) | Marketing pages, about us |
| `sales_rep` | Sales reps only | Demo guide, sales training |
| `admin` | Admins only | System admin docs |
| `dealer` | Dealers only | Dealer-specific guides |

When a user requests docs:
- Admin sees: `admin`, `all` docs
- Sales Rep sees: `sales_rep`, `all` docs
- Dealer sees: `dealer`, `all` docs
- Public (no login) sees only: `public`, `all` docs

---

## Example Workflow

### Setup (Day 1)
```bash
# Initialize defaults
POST /api/admin/docs/init-defaults

# Verify guides were created
GET /api/admin/docs
```

### Create New Guide (Day 2)
```bash
# Create internal admin documentation
POST /api/admin/docs
{
  "slug": "admin-procedures",
  "title": "Admin Procedures Manual",
  "category": "admin",
  "audience": "admin",
  "content": "# Internal Procedures\n\n...",
  "published": true
}
```

### Sales Rep Views It
```bash
# Sales rep tries to access admin docs
GET /auth/docs/admin-procedures

# ❌ Returns 403 Forbidden (not in "admin" audience)
```

### Publish to Sales Reps
```bash
# Admin updates audience
PUT /api/admin/docs/admin-procedures
{
  "audience": "sales_rep"  # Now they can see it!
}

# Sales rep now sees it
GET /auth/docs/admin-procedures
# ✅ Returns full content
```

---

## Pre-Seeded Content

### Demo Account Guide
- **Slug:** `demo-account-guide`
- **Audience:** sales_rep
- **Category:** demo
- **Content:** How to access and use demo accounts
- **Sections:**
  - Getting Started
  - Sample Listings
  - Demo Scenarios (5 examples)
  - Resetting Your Demo
  - FAQs
  - Tips & Tricks

### Sales Guide
- **Slug:** `sales-guide`
- **Audience:** sales_rep
- **Category:** sales
- **Content:** Company info and how to sell YachtVersal
- **Sections:**
  - About YachtVersal
  - Company Details
  - The Problem We Solve
  - Core Features (7 features)
  - Subscription Tiers
  - Competitive Advantages
  - Sales Pitch Template
  - Objection Handling
  - Discovery Questions
  - Closing Techniques
  - Scenario-Based Selling
  - Success Metrics

---

## Content Tips

### Use Markdown for Formatting

```markdown
# Heading 1
## Heading 2
### Heading 3

**Bold text**
*Italic text*

- Bullet point
- Another point

1. Numbered list
2. Second item

[Link text](https://example.com)

> Quote or callout
```

### Keep It Organized

- Use clear headings (H1, H2, H3)
- Break content into sections
- Include a table of contents for long docs
- Use bullet points for lists

### Write for Your Audience

- **Sales Reps:** Use action-oriented language, include examples
- **Admins:** Include technical details and procedures
- **Dealers:** Focus on features and benefits
- **Public:** Friendly, no jargon

---

## Best Practices

✅ **Do:**
- Create guides for common questions
- Update guides when features change
- Use consistent formatting
- Include screenshots/examples (as text descriptions or links)
- Version control your docs (keep old versions as drafts)
- Review guides before publishing

❌ **Don't:**
- Create duplicate guides (merge or redirect instead)
- Leave unpublished drafts (delete or publish)
- Use overly technical jargon for non-technical audiences
- Forget to assign appropriate audience levels

---

## API Endpoints Summary

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/admin/docs/init-defaults` | Admin | Seed default guides |
| POST | `/api/admin/docs` | Admin | Create documentation |
| GET | `/api/admin/docs` | Admin | List all documentation |
| GET | `/api/admin/docs/{slug}` | Admin | View documentation (edit view) |
| PUT | `/api/admin/docs/{slug}` | Admin | Update documentation |
| DELETE | `/api/admin/docs/{slug}` | Admin | Delete documentation |
| GET | `/auth/docs` | Optional | List available guides (user's audience) |
| GET | `/auth/docs/{slug}` | Optional | Read a guide (if user has access) |

---

## Troubleshooting

**Q: I updated a guide but sales reps don't see the change**
- A: Make sure `published: true` and check the `updated_at` timestamp. The system caches may need 1-2 seconds.

**Q: A guide says "access denied"**
- A: Check the `audience` field. Make sure it matches the user's role.

**Q: How do I redirect a guide to a new one?**
- A: Update the old guide's content with a link to the new one, or delete it.

**Q: Can I reorder guides?**
- A: Yes! Update the `order` field (lower = higher priority).

---

## Future Enhancements

- [ ] Search across documentation
- [ ] Version history / revision tracking
- [ ] HTML/rich text editor (currently markdown)
- [ ] Embedded videos or media
- [ ] Automated screenshots
- [ ] Multilingual content
- [ ] View analytics (which guides are most read)

