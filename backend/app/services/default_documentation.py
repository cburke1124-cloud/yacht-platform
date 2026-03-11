"""
Default documentation content for YachtVersal.
These get seeded into the documentation table on first run.
"""

DEMO_ACCOUNT_GUIDE = {
    "slug": "demo-account-guide",
    "title": "Demo Account Guide",
    "description": "How to access and use your demo dealer account",
    "category": "demo",
    "audience": "sales_rep",
    "order": 1,
    "content": """# Demo Account Guide for Sales Reps

## Overview

Your demo account is a fully functional dealer dashboard that showcases all YachtVersal features. Use it to demonstrate the platform to prospects.

**Key Points:**
- 🎯 Isolated environment (your own dealer account)
- 📋 Pre-populated with 8 sample yacht listings
- 🔧 Full access to all dashboard features
- 🔄 Can be reset to pristine state at any time
- ⏱️ Unlimited trial period

---

## Getting Started

### Step 1: Check Your Demo Account

Log in to your **sales rep account**, then navigate to:

**Dashboard → Demo Account** (or Sales Tools)

Click **"Check Demo Status"** to see if your demo account has been set up.

### Step 2: Access Your Demo

Click **"Access Demo Account"** button to get your temporary login token.

Your browser will redirect to the **dealer dashboard** while logged in as your demo account.

### Step 3: Explore Features

Walk through the dashboard and show prospects:
- 📊 Dashboard overview & analytics
- 🚢 Listing management & search
- 💬 Inquiry & message handling
- 📱 Lead tracking & CRM tools
- ⚙️ Settings & preferences
- 🔧 Integrations (webhooks, API keys)

---

## Sample Listings Included

Your demo comes with **8 pre-configured listings:**

| Boat | Type | Price | Year |
|------|------|-------|------|
| Azimut 55 | Motor Yacht | $2.50M | 2024 |
| Sunseeker 76 | Express Cruiser | $3.80M | 2022 |
| Lagoon 450 | Sailing Catamaran | $0.85M | 2021 |
| Sea Ray 460 | Motor Yacht | $1.20M | 2019 |
| Jeanneau 64 | Sailing Yacht | $2.20M | 2023 |
| Swift Trawler 50 | Trawler | $0.98M | 2020 |
| Princess 68 | Motor Yacht | $4.50M | 2023 |
| Zodiac Yachtline 480 | Tender | $0.45M | 2018 |

---

## Demo Scenarios

### Scenario 1: Search & Discovery
1. Go to **Listings** page
2. Search by price range (e.g., $1M - $3M)
3. Filter by boat type (Motor Yacht, Sailing Yacht, etc.)
4. Show map view and detailed listings
5. Highlight advanced search + saved searches feature

### Scenario 2: Inquiry Management
1. Go to **Inquiries/Messages**
2. Explain how buyers submit inquiries
3. Show response time tracking
4. Demo CRM lead stages (New → Negotiating → Sold)
5. Show inquiry notes for team collaboration

### Scenario 3: Analytics
1. Go to **Dashboard/Analytics**
2. Show listing views & inquiry trends
3. Explain top-performing listings
4. Show team member performance (if multi-user)

### Scenario 4: Listing Creation
1. Go to **Create Listing**
2. Walk through form (boat specs, pricing, features)
3. Explain photo upload & management
4. Show draft & publish workflow
5. Explain featured listing promotion

### Scenario 5: Admin Features
1. Show **API Keys** (for integrations)
2. Explain **Webhooks** (lead delivery to DMS/CRM)
3. Show **Team Management** (if applicable)
4. Demo **Integrations** tab

---

## Resetting Your Demo

If you want to start fresh:

1. Go to **Dashboard → Demo Account**
2. Click **"Reset Demo to Pristine State"**
3. Contact your admin if you don't see the button

This will:
- ✅ Delete all inquiries/messages
- ✅ Restore original 8 sample listings
- ✅ Reset view counts to zero
- ✅ Clear all modifications

---

## FAQs

**Q: Can I delete or modify listings?**
- A: Yes! Treat it like a real dealer account. If you want to start over, hit reset.

**Q: Can I send real inquiries to this demo?**
- A: No, the demo uses `.demo` domain so buyers can't find it. It's only for internal demonstrations.

**Q: What if I need a fresh copy?**
- A: Your admin can reset it instantly via `POST /api/admin/demo-account/{id}/reset`.

**Q: Can multiple people access the same demo?**
- A: Each sales rep gets their own demo account, so no sharing needed. If you do want to share, contact your admin.

**Q: How long can I keep the demo?**
- A: As long as you need! There's no expiration. It's yours to use for sales demonstrations.

---

## Tips & Tricks

- 💡 **Add custom notes** to listings to highlight key selling points
- 💡 **Create mock inquiries** by submitting from another browser/device
- 💡 **Use the API docs** to show technical prospects webhook/API capabilities
- 💡 **Screenshot the dashboard** for sales collateral
- 💡 **Show export features** (if available) to demonstrate data portability

---

## Getting Help

- **Dashboard questions?** Contact your team lead
- **Feature ideas?** Submit via admin dashboard
- **Report an issue?** Contact your manager with screenshot

---

## Next Steps

1. ✅ Access your demo account
2. ✅ Explore all dashboard sections
3. ✅ Practice your demo pitch
4. ✅ Identify 3-5 key features to highlight
5. ✅ Schedule a demo with your first prospect!

---

**Ready to show off YachtVersal? 🚀**
"""
}

SALES_GUIDE = {
    "slug": "sales-guide",
    "title": "YachtVersal Sales Guide",
    "description": "Company overview, features, and how to sell YachtVersal",
    "category": "sales",
    "audience": "sales_rep",
    "order": 1,
    "content": """# YachtVersal Sales Guide

## About YachtVersal

**YachtVersal** is the premier all-in-one yacht and boat listing platform for dealers and brokers. We combine powerful technology with industry expertise to help dealers sell more boats faster.

### Key Differentiators

✅ **All-in-One Platform** - Search, listings, CRM, messaging, analytics (no jumping between tools)
✅ **Built for Dealers** - Not a generic marketplace; designed by yacht industry veterans
✅ **Buyer Network** - 100K+ active boat shoppers across all price ranges
✅ **DMS Integration** - Direct webhook delivery to dealer management systems
✅ **Mobile-First** - Full functionality on smartphones (buyers shop on-the-go)
✅ **Advanced Analytics** - Real-time performance tracking per listing
✅ **Zero Commission** - Dealers keep 100% of their sales (we charge platform subscription)

---

## Company Details

**Headquarters:** Miami, Florida (yacht capital of the US)
**Founded:** 2024
**Team:** 25+ engineers, designers, and yacht industry experts
**Customers:** 200+ dealer and broker organizations
**Listings:** 15,000+ active boat listings
**Monthly Traffic:** 500K+ unique visitors
**Languages:** English (Spanish coming soon)

---

## The Problem We Solve

### Before YachtVersal
- 🚫 Dealers post to 5-10 different sites (time-consuming)
- 🚫 Leads scattered across email, phone, text, multiple platforms
- 🚫 No centralized CRM for boat sales workflow
- 🚫 Limited visibility into which listings are actually performing
- 🚫 No integration with their existing DMS/CRM systems
- 🚫 Buyers fragment their search across Google, Facebook, specialized sites

### With YachtVersal
- ✅ Post once, appear everywhere (distribution to major portals)
- ✅ All inquiries in one unified inbox
- ✅ Built-in CRM with lead stages and team collaboration
- ✅ Real-time analytics on every listing (views, inquiries, conversion)
- ✅ Webhook delivery to existing tech stack
- ✅ Centralized marketplace where serious buyers congregate

---

## Core Features

### 1. Listing Management
- Create listings in under 5 minutes
- Upload unlimited photos & videos
- Detailed specs (length, year, engine, features, etc.)
- Rich descriptions with formatting
- Drag-and-drop photo management
- Bulk import from inventory system
- Automatic SEO optimization

**Selling Point:** "Sell faster by getting your inventory visible instantly"

### 2. Powerful Search
- Filter by price, boat type, location, year, size
- Map view for geographic browsing
- Saved searches (buyers can track new listings)
- Price alerts (notification when similar boats listed)
- Comparison tool (side-by-side specs)
- Mobile-optimized discovery

**Selling Point:** "Your listings get found by motivated buyers immediately"

### 3. Inquiry Management
- Unified inbox for all buyer inquiries
- Email, SMS, and in-app messaging
- Auto-response templates
- Inquiry scoring (hot leads bubble up)
- Lead stage tracking (New → Viewing → Negotiating → Sold)
- Mobile notifications for real-time response

**Selling Point:** "Never miss a serious buyer again"

### 4. Team Collaboration
- Assign inquiries to sales reps
- View teammate activity
- Sales rep performance metrics
- Commission tracking (optional)
- Secure notes & internal comments
- Role-based permissions

**Selling Point:** "Keep your whole team aligned and accountable"

### 5. Analytics & Reporting
- Real-time view counts per listing
- Inquiry source tracking
- Response time analytics
- Team performance dashboards
- Conversion tracking (views → inquiries → sales)
- Export reports for management

**Selling Point:** "Data-driven selling: Know which listings work and optimize"

### 6. DMS Integration
- Webhook delivery to dealer management systems
- Send leads to existing CRM software
- Automate workflow between platforms
- Support for major DMS providers (Oneonta, Nada, etc.)
- API access for custom integrations

**Selling Point:** "Fits seamlessly into your existing tech stack"

### 7. Mobile App
- Full dealer dashboard on smartphone
- Receive buyer inquiries in real-time
- Respond to messages on-the-go
- View analytics anywhere
- Photo uploads from boat location

**Selling Point:** "Manage your business from anywhere"

---

## Subscription Tiers

### Free Tier
- ✅ Up to 5 active listings
- ✅ Basic search (buyers)
- ✅ Email inquiries only
- ✅ No API access
- **Perfect for:** Brokers testing the platform

### Basic ($29/month)
- ✅ Up to 25 active listings
- ✅ Full search & messaging
- ✅ Team management (up to 3 reps)
- ✅ Analytics dashboard
- ❌ No webhooks/API
- **Perfect for:** Small dealerships & independent brokers

### Plus ($59/month)
- ✅ Up to 75 active listings
- ✅ Everything in Basic, plus:
- ✅ Webhook delivery
- ✅ Read-only API access
- ✅ Team management (unlimited reps)
- ✅ Priority support
- **Perfect for:** Growing dealerships

### Pro ($99/month)
- ✅ Unlimited listings
- ✅ Everything in Plus, plus:
- ✅ Full read/write API
- ✅ Custom integrations support
- ✅ Dedicated account manager
- ✅ Advanced analytics
- **Perfect for:** Large dealer groups & marinas

---

## Competitive Advantages

### vs. Autotrader.com
- ✅ Built specifically for boats (not cars/trucks)
- ✅ Flat subscription (no per-listing fees)
- ✅ Included CRM (Autotrader charges extra)
- ✅ Better team collaboration features

### vs. Facebook/Google Ads
- ✅ Buyers actively searching (not passive scrolling)
- ✅ Detailed specs & filtering (better qualified leads)
- ✅ CRM included (Facebook doesn't help manage sales)
- ✅ No ad spend required (organic traffic)

### vs. Craigslist/Local Sites
- ✅ Professional, dedicated buyer audience
- ✅ Advanced search & filtering
- ✅ Secure messaging (no phone number exposure)
- ✅ International reach

### vs. Multiple Site Management
- ✅ Post once, distribute everywhere
- ✅ Centralized analytics
- ✅ Single team workspace
- ✅ Lower time investment

---

## Sales Pitch Template (5 minutes)

**Opening:**
"YachtVersal is the all-in-one platform dealers use to list boats, manage inquiries, and close sales faster. You post listings once and reach 100K+ active boat shoppers. All inquiries come to one unified inbox where your team can collaborate and track performance."

**Problem:**
"Right now, your inventory is scattered across multiple sites, inquiries come in through different channels, and there's no unified way to track which listings are actually performing or which reps are converting leads."

**Solution:**
"YachtVersal solves this by (1) centralizing all your listings, (2) unifying all buyer inquiries into one CRM, (3) showing you real-time performance analytics, and (4) integrating directly with your existing DMS."

**Proof:**
"We have 200+ dealers using the platform, averaging 3x more qualified inquiries per listing compared to standalone sites."

**Call to Action:**
"Let me show you how it works. I'll walk you through the demo in about 10 minutes. If you like what you see, you can have your inventory live today and start getting leads tomorrow."

---

## Objection Handling

### "We're already using [other platform]"
- **Response:** "I understand. Most dealers are on multiple sites. The issue is it takes 3x longer and you lose track of performance. YachtVersal brings everything together AND you can still use your existing platform."

### "It costs money each month"
- **Response:** "Think of it this way: If YachtVersal generates even ONE extra qualified lead per month, it pays for itself. Most dealers see 5-10 extra inquiries in the first month."

### "We don't have time to list our inventory"
- **Response:** "Good news: You can import from your current system (if digital) in minutes. Or we can help with a bulk upload. After that, new listings take 5 minutes."

### "How does it compare to [competitor]?"
- **Response:** "Great question. [Competitor] is designed for [use case]. YachtVersal is specifically built for boats. Plus, we're 40% cheaper and have CRM included."

### "I need to talk to my manager/owner"
- **Response:** "Absolutely. Let me send you a quick one-pager so you can review. Why don't we schedule a 15-minute demo next Tuesday so your manager can see it live?"

---

## Discovery Questions

Use these questions to understand the prospect's needs:

1. **"How many boats are you currently listing online?"**
   - Identifies current reach

2. **"Where do you post your inventory?"**
   - Maps current platforms

3. **"Do you track inquiries from each listing?"**
   - Assesses current analytics gaps

4. **"How many sales reps do you have managing inquiries?"**
   - Determines team size

5. **"Are you integrated with a DMS?"**
   - Identifies need for API/webhook

6. **"What's your biggest frustration with selling boats online?"**
   - Opens door to pain points

7. **"How much time do your reps spend each week managing inquiries?"**
   - ROI conversation

8. **"When would you want to go live if you decided to use YachtVersal?"**
   - Closing timeline

---

## Closing Techniques

### The Demo Close
"Based on what you've told me, I think you'll really see the value in [specific feature]. Let me show you how it works in just 10 minutes. Fair?"

### The Trial Close
"Would it make sense to get your top 10 listings live this week so you can see real results?"

### The Champion Close
"Who on your team should I be working with to get this implemented?"

### The Urgency Close
"New dealers joining get featured placement this month. Let's get you set up today so you don't miss that opportunity."

---

## Resources

- **Demo Account:** Access via dashboard (reset anytime)
- **Sample Listings:** 8 pre-configured boats showing all listing tools
- **Pricing Calculator:** Show ROI based on their inventory size
- **Case Studies:** Available from sales manager
- **Technical Docs:** For IT teams / integration discussions

---

## Common Selling Scenarios

### Scenario 1: Small Broker (1-5 Boats)
- 📍 **Hook:** Free tier or subsidized Basic plan
- 📋 **Message:** "Start free, grow with us. Scale up when you expand."
- 🎯 **CTA:** "Let's get your 5 boats live this week."

### Scenario 2: Medium Dealership (25-100 Boats)
- 📍 **Hook:** Plus tier ($59/mo) with webhook integration
- 📋 **Message:** "Centralize everything, integrate with your DMS, see exactly what's working."
- 🎯 **CTA:** "Let's schedule a 30-min tech call with your IT team."

### Scenario 3: Large Dealer Group (500+ Boats)
- 📍 **Hook:** Pro tier with custom integrations & dedicated support
- 📋 **Message:** "Custom solution built for your scale. Your reps stay in their existing tools."
- 🎯 **CTA:** "Let's get your Chief Digital Officer in a meeting."

---

## Success Metrics

Track your sales effectiveness:

✅ **Demos Completed:** Per week (aim for 5-10)
✅ **Trial Sign-ups:** % of demos (aim for 40-50%)
✅ **Conversions:** % of trials to paid (aim for 60%)
✅ **Upsells:** Plus → Pro conversions (watch for integration needs)
✅ **Customer Satisfaction:** NPS score (aim for 50+)
✅ **Deal Size:** Average subscription value (track tier mix)

---

## Compensation

🎯 **Commissions:** [To be filled in by sales manager]
🎯 **Bonuses:** [To be filled in by sales manager]
🎯 **Contests:** [To be filled in by sales manager]

---

## Next Steps

1. ✅ Access your demo account
2. ✅ Run through the 5-minute pitch
3. ✅ Practice with 3 prospects this week
4. ✅ Report results to sales manager
5. ✅ Schedule weekly coaching call

---

**Questions?** Contact your Sales Manager or Head of Sales.

**Ready to crush quota?** 🚀 Get your first demo on the calendar!
"""
}

DEFAULT_DOCS = [DEMO_ACCOUNT_GUIDE, SALES_GUIDE]


def get_default_doc_by_slug(slug: str):
    """Get default doc content by slug."""
    for doc in DEFAULT_DOCS:
        if doc["slug"] == slug:
            return doc
    return None
