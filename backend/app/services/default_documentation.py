"""
Default documentation content for YachtVersal.
These get seeded (and auto-updated) into the documentation table on startup.
"""

DEMO_ACCOUNT_GUIDE = {
    "slug": "demo-account-guide",
    "title": "Demo Account Guide",
    "description": "How to access and use your demo dealer account for live prospect walkthroughs",
    "category": "demo",
    "audience": "sales_rep",
    "order": 1,
    "content": """# Demo Account Guide

## What Is Your Demo Account?

Every YachtVersal sales rep gets a dedicated demo dealer account. This is a fully functional dealer dashboard — identical to what your prospects will use — pre-loaded with sample yacht listings so you can give live walkthroughs without affecting real data.

Your demo account includes:
- A branded dealer profile ("Demo Brokerage" or custom name)
- 8 pre-loaded yacht listings with photos, specs, and pricing
- Full access to every dashboard feature (listings, inquiries, CRM, analytics, team, billing, media, API keys)
- Unlimited usage — no trial expiration
- Reset capability to return everything to pristine state

---

## Accessing Your Demo

1. Log in to your Sales Rep dashboard at /sales-rep
2. Click the "Demo Portal" tab in the navigation bar
3. If your demo account is active, click "Open Demo Dashboard" to launch it in a new tab
4. If your demo isn't set up yet, send a message to your admin requesting provisioning

The demo dashboard opens in a separate browser tab so you can switch between your sales rep view and the demo during calls.

---

## The 6-Step Demo Walkthrough

Follow this sequence when demoing to prospects. It mirrors how a real dealer would use the platform daily.

### Step 1: Listings Management (3 minutes)

This is where most dealers spend their time, so start here.

What to show:
- The listings grid with 8 sample yachts (photos, prices, status badges)
- Click into any listing to show the edit form with 40+ specification fields
- Highlight: boat dimensions, engine details, pricing, location, features checklist
- Show the photo gallery with drag-and-drop reordering
- Demonstrate the "AI Text Import" — paste a block of text and AI extracts all specs automatically
- Show how listings can be toggled between Draft and Published
- Point out the featured listing badge (paid promotion option)

Key talking points:
- "Creating a listing takes under 5 minutes"
- "The AI import means you can copy-paste from your existing system and we do the data entry"
- "40+ spec fields means buyers get complete information, which means more qualified inquiries"

### Step 2: Search & Buyer Discovery (2 minutes)

Open the public search page (yachtversal.com/search) in another tab.

What to show:
- The advanced filter panel: price range, boat type, year, length, location, condition
- AI-powered natural language search — type "50 foot motor yacht under 2 million" and results appear
- Map view showing listing locations
- Individual listing pages with photo galleries, spec tables, inquiry forms
- Saved search and price alert features (buyers get emailed when matching boats are listed)
- Side-by-side comparison tool

Key talking points:
- "Buyers search by exactly what they want — your listings show up to the right audience"
- "AI search means even casual browsers find relevant boats, not just power users"
- "Price alerts keep buyers engaged even when they're not actively browsing"

### Step 3: Lead & Inquiry Management (3 minutes)

Navigate to the Inquiries section of the demo dashboard.

What to show:
- The inquiry inbox with sample leads
- Lead scoring indicators (hot, warm, cold based on engagement)
- Lead stage pipeline: New → Contacted → Viewing → Negotiating → Won/Lost
- Notes field for internal team comments on each lead
- The ability to assign leads to specific team members
- Response time tracking
- Quick reply and message threading

Key talking points:
- "Every inquiry from every channel lands here — email, phone form, in-app message"
- "Lead scoring tells your reps which buyers to call first"
- "Stage tracking means nothing falls through the cracks — you always know where every deal stands"

### Step 4: CRM Integrations & Webhooks (2 minutes)

Navigate to the CRM / Integrations section.

What to show:
- The 6 pre-built CRM integrations: HubSpot, Salesforce, GoHighLevel, Zoho CRM, DealerSocket, custom webhook
- Webhook configuration panel — show the URL, payload format, and test button
- Explain that every inquiry triggers an instant webhook to their existing system
- Show the webhook delivery log with success/failure status
- API Keys section for developers who want programmatic access

Key talking points:
- "Your existing CRM keeps working. We push leads directly into it in real-time."
- "No manual data entry — the moment a buyer inquires, it appears in your DMS"
- "For IT teams: we have full REST API access for custom integrations"

### Step 5: Analytics & Media (2 minutes)

What to show:
- Analytics dashboard: views per listing, inquiry trends, conversion rates
- Top-performing listings ranked by engagement
- Team performance metrics (if multi-user)
- Media library with all uploaded photos and videos
- Auto-optimization (images compressed, videos transcoded for web)
- Bulk upload capability for media

Key talking points:
- "Know exactly which boats are getting attention and which need price adjustments or better photos"
- "Media library stores everything centrally — no more scattered files"

### Step 6: Team Management & Billing (1 minute)

What to show:
- Team members list with role-based permissions (Admin, Editor, Viewer)
- Invite flow for adding new team members
- Billing section with subscription tier, payment history, and upgrade options
- Dealer Profile editor (company logo, about text, contact info, social links)

Key talking points:
- "Add your whole team. Control who can edit listings vs. who can only view"
- "Billing is simple — one monthly subscription, no per-listing fees, no commission on sales"

---

## Handling Demo-Specific Questions

Q: "Is this real data?"
A: "This is your personal demo environment with sample listings. It works identically to a real account — same features, same dashboard, same tools. The only difference is these listings aren't visible to public buyers."

Q: "Can I customize this demo?"
A: "Absolutely. You can edit listings, add new ones, change the company profile, and configure integrations. If you want to start fresh, I can reset it to the original state instantly."

Q: "How long does setup take for a real account?"
A: "Most dealers are live within 30 minutes. If you have digital inventory we can bulk import it. Otherwise, creating each listing takes about 5 minutes."

Q: "What happens to my data if I cancel?"
A: "You can export everything at any time. After cancellation, your data is preserved for 90 days so you can reactivate without losing anything."

---

## Resetting Your Demo

If your demo gets cluttered from testing:

1. Go to your Sales Rep dashboard → Demo Portal tab
2. Contact your admin to reset the demo
3. Your admin can reset via the Admin Dashboard → Demo Accounts

Resetting restores:
- All 8 original sample listings
- Clean inquiry/message history
- Zero view counts
- Fresh analytics

---

## Pro Tips for Effective Demos

- Always screen-share with the prospect, don't just describe features
- Start with the feature most relevant to their expressed pain point
- Keep demos under 15 minutes — if they want more, schedule a follow-up
- Ask questions between steps: "Is this something your team struggles with today?"
- End every demo with a specific next step (trial signup, team call, etc.)
- Use the mobile view to show phone-friendly interface — brokers love this
- If the prospect has inventory, offer to import a few listings live during the demo

---

Ready to demo? Open your Demo Portal tab and start practicing!
"""
}

SALES_GUIDE = {
    "slug": "sales-guide",
    "title": "Sales Playbook",
    "description": "Complete guide to selling YachtVersal — pitch frameworks, objection handling, and closing strategies",
    "category": "sales",
    "audience": "sales_rep",
    "order": 2,
    "content": """# YachtVersal Sales Playbook

## The YachtVersal Story

YachtVersal is the all-in-one yacht and boat listing platform built exclusively for dealers and brokers. Unlike generic marketplace sites, every feature was designed around how marine dealerships actually operate — from intake to sale.

We are not a classified ads site. We are a complete business platform that combines:
- A high-traffic buyer marketplace
- A professional listing management system
- An integrated CRM and lead pipeline
- Real-time analytics and performance tracking
- Direct integrations with dealer management systems
- Team collaboration and permission management

The result: dealers sell more boats, respond faster to buyers, and run their business from one place instead of juggling 5-10 different tools.

---

## Why Brokers Need YachtVersal

### The Problem Every Dealer Faces

Marine dealers today are overwhelmed:
- Inventory is scattered across Boat Trader, YachtWorld, Facebook, Craigslist, their own website, and more
- Leads come in through email, phone, text, web forms, and social media DMs — no central place to track them
- They have no visibility into which listings are performing and which are stale
- Their team has no shared system — leads get lost, follow-ups get missed
- Integration with their DMS or CRM is either nonexistent or requires expensive custom development
- Per-listing fees on other platforms eat into margins on lower-priced boats

### What We Solve

YachtVersal replaces the chaos with a single platform:
1. POST ONCE, REACH EVERYONE — One listing entry, visible to our entire buyer network
2. UNIFIED INBOX — Every inquiry from every source in one place with threading and history
3. SMART LEAD MANAGEMENT — Lead scoring, stage tracking, notes, team assignment
4. REAL-TIME ANALYTICS — Views, inquiries, conversion rates per listing and per rep
5. DIRECT CRM INTEGRATION — Webhook delivery to HubSpot, GoHighLevel, Salesforce, Zoho, DealerSocket, or any custom endpoint
6. FLAT PRICING — One monthly subscription, no per-listing fees, no commission on sales

---

## Subscription Tiers

### Free Tier — $0/month
- Up to 5 active listings
- Basic buyer search visibility
- Email-only inquiries
- No API or webhook access
- Best for: Private sellers or brokers evaluating the platform

### Basic — $29/month
- Up to 25 active listings
- Full search visibility and messaging
- Inquiry dashboard with lead stages
- Team management (up to 3 members)
- Basic analytics
- Best for: Independent brokers and small dealerships

### Plus — $59/month
- Up to 75 active listings
- Everything in Basic, plus:
- Webhook delivery to CRM systems
- Read-only API access
- Unlimited team members
- Featured listing eligibility
- Priority support
- Best for: Growing dealerships with 25-75 boats

### Pro — $99/month
- Unlimited active listings
- Everything in Plus, plus:
- Full read/write API access
- Custom integration support
- Advanced analytics and reporting
- Dedicated account manager
- Best for: Large dealer groups, marinas, and multi-location operations

### Ultimate — Custom Pricing
- Everything in Pro, plus:
- White-label options
- Custom API rate limits
- Dedicated infrastructure
- SLA guarantees
- Custom feature development
- Best for: Enterprise brokerages and franchise operations
- Sales process: Refer to admin — commission negotiated individually

---

## Your Commission Structure

You earn 10% recurring commission on every dealer subscription for as long as they remain active.

Examples:
- Basic dealer ($29/mo) = $2.90/month to you, recurring
- Plus dealer ($59/mo) = $5.90/month to you, recurring
- Pro dealer ($99/mo) = $9.90/month to you, recurring
- Ultimate dealer = Custom commission negotiated per deal

This is RECURRING revenue. A Pro dealer pays you $9.90 every single month. Ten Pro dealers = $99/month passive income, growing over time.

Key points:
- Commission is tracked automatically when dealers sign up via your referral link or deal code
- You can see all your commission data in the Overview tab
- Upsells count — help a Basic dealer upgrade to Pro and your commission triples
- Ultimate tier commissions are set per-deal by management

---

## The 5-Minute Pitch

Use this framework when you have limited time:

### Opening (30 seconds)
"YachtVersal is the platform yacht dealers use to list their inventory, manage buyer inquiries, and close sales — all from one dashboard. We combine a high-traffic buyer marketplace with a built-in CRM, analytics, and direct integrations with your existing systems."

### Pain Point (30 seconds)
"Right now, you're probably posting inventory to multiple sites, getting leads from different channels, and spending hours just keeping track of who contacted you about which boat. Your reps are doing data entry instead of selling."

### Solution (1 minute)
"We fix that. You enter a listing once and it reaches our entire buyer network. Every inquiry — whether it comes from email, phone, or our site — lands in one unified inbox. You can score leads, track stages from New to Sold, and your team can collaborate with notes and assignments. And it all pushes directly into your CRM or DMS via webhooks."

### Differentiator (30 seconds)
"Unlike competitors, we charge a flat monthly fee — no per-listing charges, no commission on your sales. You keep 100% of what you sell. And we built AI-powered search, so buyers find your boats by describing what they want in plain language."

### Social Proof (30 seconds)
"Dealers on our platform see 3x more qualified inquiries per listing compared to standalone sites, and the average response time drops from hours to minutes because everything is in one place."

### Close (1 minute)
"Let me show you how it works. I can walk you through a live demo in 10 minutes. If you like what you see, you can have your inventory live today and start getting leads by tomorrow. Want to take a look?"

---

## Objection Handling

### "We already use [Boat Trader / YachtWorld / etc.]"
"And you should absolutely keep using them — we're not asking you to leave those platforms. YachtVersal adds another channel of qualified buyers while also giving you the CRM and analytics layer that those platforms don't. Think of us as the hub that ties everything together."

### "We don't have budget for another subscription"
"Totally understand. Let me frame it this way: at $29/month for Basic, you need ONE extra qualified lead per month to more than pay for the platform. Most dealers see 5-10 extra inquiries in the first month. And unlike per-listing sites, our pricing stays flat no matter how many boats you list."

### "We don't have time to set up another platform"
"Great news — setup takes less than 30 minutes. If you have your inventory in a spreadsheet or another system, we can bulk import it. After that, each new listing takes about 5 minutes. And with AI text import, you can paste an existing listing description and we extract all the specs automatically."

### "I need to talk to my manager/owner"
"Absolutely, they should see this. Let me send you a one-page summary, and let's schedule a 15-minute demo next week so they can see it live. What day works best?"

### "How are you different from [competitor]?"
"[Competitor] is focused on [their specific angle]. YachtVersal is a complete business platform — you get the marketplace AND the CRM AND the analytics AND the team tools AND the integrations, all in one subscription. Competitors typically charge separately for each of those pieces, if they offer them at all."

### "We have a custom website already"
"Perfect — your website stays as your brand anchor. YachtVersal gives you additional buyer reach through our marketplace, plus the back-office tools you probably don't have: lead scoring, stage tracking, team assignment, response time analytics, and CRM webhooks. Your website handles branding; we handle lead generation and management."

### "What if we cancel?"
"No lock-in contracts. Cancel anytime. Your data is preserved for 90 days so you can reactivate without losing anything. You can also export all your listings and lead history at any time."

---

## Discovery Questions

Ask these to understand the prospect and tailor your pitch:

1. "How many boats do you currently have in inventory?"
   → Determines which tier to recommend

2. "Where do you currently list your boats?"
   → Maps their current tool landscape and pain points

3. "How do you track buyer inquiries today?"
   → Identifies CRM gap — this is usually the biggest pain point

4. "How many people on your team handle sales?"
   → Team management becomes a selling point for 3+ people

5. "Are you using any CRM or DMS system?"
   → If yes: webhook integration is a major value-add
   → If no: our built-in CRM is their first real system

6. "What's your biggest frustration with selling boats online?"
   → Let them tell you the pain — then map it to our features

7. "How quickly do you typically respond to new inquiries?"
   → Response time analytics and notifications become the hook

8. "Have you tracked which of your listings get the most views?"
   → If no: our analytics are eye-opening
   → If yes: they're data-driven and will love our dashboard

---

## Closing Techniques

### The Demo Close
"Based on what you've told me, I think [specific feature] would be a game-changer for you. Let me show you exactly how it works — it'll take 10 minutes. Fair?"

### The Trial Close
"Would it make sense to get your top 10 listings live this week? You can see real results with zero risk."

### The Champion Close
"Who on your team should I work with to get this implemented? I want to make sure the right person sees the setup process."

### The Pain Close
"You mentioned you're losing leads because they come in from different channels. If we can fix that this week, what would that be worth to your business?"

### The Upgrade Path
"Most dealers start on Basic to test the water, then upgrade to Plus within 60 days because they want the webhook integration. So think of Basic as your proving ground."

---

## Selling to Different Segments

### Small Broker (1-10 Boats)
- Lead with: Free or Basic tier, simplicity, quick setup
- Key message: "You're spending more time managing listings than selling boats. Let's fix that."
- Anticipate: Budget sensitivity, "I'm just one person"
- Close with: "Get your boats live this week. Start free, upgrade when you're ready."

### Mid-Size Dealership (25-100 Boats)
- Lead with: Plus tier, CRM/webhook integration, team features
- Key message: "Centralize everything. Your team works from one dashboard, leads never fall through the cracks."
- Anticipate: IT questions, DMS compatibility, "does it work with our system"
- Close with: "Let's schedule a 30-minute tech call with your IT person."

### Large Dealer Group (100+ Boats)
- Lead with: Pro or Ultimate tier, unlimited listings, API, dedicated support
- Key message: "Custom solution for your scale. Your existing tools keep working — we enhance them."
- Anticipate: Security questions, SLA, data ownership, compliance
- Close with: "Let's get your Director of Operations on a call."

### Marina / Service Center
- Lead with: Basic or Plus tier, focus on listing brokerage boats
- Key message: "Your slip-holders want to sell. You can broker those deals and manage everything from here."
- Anticipate: "We're not really a dealership"
- Close with: "Start with 5-10 brokerage listings and see how it goes."

---

## After the Sale

Your job doesn't end at signup. Happy dealers stay longer (more recurring commission) and refer other dealers.

Post-sale checklist:
1. Help them import their first batch of listings (or at least the first 3-5)
2. Show them how to set up their CRM webhook integration
3. Introduce them to the Media Library for photo management
4. Check in after 1 week to see how inquiries are flowing
5. Check in after 1 month to see if they're ready for an upgrade
6. Stay available for questions — you're their trusted advisor

---

Ready to start selling? Head to the Deals & Links tab to grab your referral link and create your first custom deal.
"""
}

PLATFORM_FEATURES_GUIDE = {
    "slug": "platform-features-guide",
    "title": "Complete Platform Features Guide",
    "description": "In-depth walkthrough of every YachtVersal feature — know the platform inside and out",
    "category": "training",
    "audience": "sales_rep",
    "order": 3,
    "content": """# Complete Platform Features Guide

This guide covers every feature on the YachtVersal platform so you can confidently answer any question a prospect asks. Study this so you know the platform as well as the engineers who built it.

---

## BUYER-FACING FEATURES

These are the features buyers (boat shoppers) see on the public website.

### Homepage & Navigation
- Hero section with rotating featured boat images
- Prominent search bar with AI-powered natural language input
- Category cards for quick browsing by boat type
- Featured listings carousel (paid promotion spots)
- Dealer spotlight section showcasing top brokerages
- Newsletter signup for market updates

### Yacht Search & Discovery
- ADVANCED FILTERS: Price range, boat type (14 categories), year range, length range, location/region, condition (new/used), fuel type, hull material, number of engines, manufacturer
- AI NATURAL LANGUAGE SEARCH: Buyers type things like "40-foot sailboat under $500k with teak interior" and get matching results instantly. This is a major differentiator — no other marine marketplace has this.
- MAP VIEW: Geographic browsing with clustered markers and price preview tooltips
- LIST VIEW: Traditional grid with sortable columns and quick-filter chips
- SAVED SEARCHES: Buyers save a search and get emailed when new matching listings appear
- PRICE ALERTS: Notifications when boats in their criteria get price drops
- COMPARISON TOOL: Side-by-side specs for up to 4 boats simultaneously

### Listing Detail Pages
- Full-screen photo gallery with swipe navigation
- Detailed spec table (40+ fields organized into sections)
- Rich text description with formatting
- Location map with approximate marker
- Contact form for direct inquiry to dealer
- "Save to Favorites" for logged-in buyers
- Similar boats carousel
- Sharing buttons (email, social)
- Financing calculator (estimated monthly payments)

### Buyer Accounts
- Save favorite listings
- Track listing history
- Manage search alerts and price alerts
- Message dealers directly through the platform
- Compare boats side by side

### Dealer Directory
- Searchable directory of all verified brokerages on the platform
- Dealer profile pages with: company info, logo, description, social links, active listings grid, contact information
- Buyers can browse by dealer, not just by boat

### Sell Your Boat Page
- Information page for private sellers interested in listing
- Directs them to register as a dealer or work with a broker

---

## DEALER DASHBOARD FEATURES

These are the features dealers get when they sign up. This is the product you're selling.

### Listings Management
- LISTING GRID: Visual overview of all inventory with status badges, photos, and quick stats
- CREATE LISTING: Full form with 40+ specification fields organized into logical sections:
  - Basic: title, make, model, year, condition, price
  - Dimensions: LOA, beam, draft, weight, displacement
  - Engines: type, make, model, horsepower, fuel type, hours
  - Features: air conditioning, generator, watermaker, stabilizers, bow thruster, etc.
  - Location: marina, city, state/country, GPS coordinates
  - Media: photo upload (drag-and-drop, reorder), video links
- AI TEXT IMPORT: Paste a block of text (from another listing site, spreadsheet, or email) and AI automatically extracts and fills in all specification fields. This saves 80% of data entry time.
- BULK IMPORT: Upload a CSV of your inventory for mass listing creation
- DRAFT/PUBLISH WORKFLOW: Save listings as drafts before publishing
- FEATURED LISTINGS: Pay to promote listings for higher visibility on the homepage and in search results
- LISTING ANALYTICS: Per-listing view counts, inquiry counts, and source tracking
- EDIT/DUPLICATE/DELETE: Full lifecycle management for each listing

### Inquiry & Lead Management
- UNIFIED INBOX: Every inquiry in one place — from email, in-app, phone (if called in), and web forms
- LEAD SCORING: Automatic classification (hot/warm/cold) based on buyer engagement signals
- LEAD STAGES: Customizable pipeline — New → Contacted → Viewing → Negotiating → Deposit → Won → Lost
- TEAM ASSIGNMENT: Assign leads to specific sales reps
- NOTES & HISTORY: Internal notes on each lead visible to the team
- RESPONSE TIME TRACKING: Metrics on how quickly your team responds to new inquiries
- QUICK REPLIES: Template responses for common questions
- MESSAGE THREADING: Full conversation history with each buyer

### CRM & Integrations
- 6 PRE-BUILT INTEGRATIONS:
  1. HubSpot — syncs leads as contacts with custom properties
  2. Salesforce — creates leads with full boat details
  3. GoHighLevel — pushes contacts with tags and custom fields
  4. Zoho CRM — creates deals with linked boat information
  5. DealerSocket — formats leads for DealerSocket import
  6. Custom Webhook — sends raw JSON payload to any URL you specify
- WEBHOOK CONFIGURATION: URL, headers, payload format (JSON), authentication options
- WEBHOOK TESTING: Send test payload to verify integration before going live
- DELIVERY LOG: Success/failure history for every webhook delivery with retry capability
- API KEYS: Generate API keys for programmatic access (read-only on Plus, read/write on Pro)

### Analytics Dashboard
- OVERVIEW METRICS: Total listings, total views, total inquiries, conversion rate
- LISTING PERFORMANCE: Top-performing boats ranked by views and inquiries
- TREND CHARTS: Daily/weekly/monthly views and inquiry volume
- TEAM METRICS: Sales rep response times and inquiry handling (for multi-user accounts)
- SOURCE TRACKING: Where your inquiries are coming from

### Media Library
- CENTRAL MEDIA STORAGE: All uploaded photos and videos in one place
- AUTO-OPTIMIZATION: Images are automatically compressed and resized for web performance
- VIDEO SUPPORT: Upload and embed videos alongside photos
- BULK UPLOAD: Drag multiple files at once
- REUSABLE ASSETS: Same image can be attached to multiple listings

### Team Management
- INVITE TEAM MEMBERS: Add reps by email
- ROLE-BASED PERMISSIONS:
  - Admin: Full access (billing, team management, all settings)
  - Editor: Can create/edit listings, respond to inquiries
  - Viewer: Read-only access to dashboard and analytics
- TEAM PERFORMANCE: Track each member's inquiry response time and volume
- Permission changes take effect immediately

### Bulk Tools
- BULK STATUS CHANGE: Mark multiple listings as sold, draft, or active at once
- BULK PRICE UPDATE: Adjust prices for selected listings by percentage or fixed amount
- BULK EXPORT: Download listing data as CSV

### Billing & Subscription
- STRIPE-POWERED BILLING: Secure payment processing
- PLAN MANAGEMENT: View current tier, upgrade/downgrade at any time
- PAYMENT HISTORY: Full invoice history with downloadable receipts
- NO LOCK-IN: Cancel anytime with no penalty

### Dealer Profile
- COMPANY INFORMATION: Name, logo, about text, founding year
- CONTACT DETAILS: Phone, email, address, website
- SOCIAL LINKS: Facebook, Instagram, Twitter, YouTube, LinkedIn
- PUBLIC PROFILE PAGE: Visible to buyers browsing the dealer directory
- SEO-OPTIMIZED: Dealer pages are indexed by search engines

### Preferences & Settings
- NOTIFICATION SETTINGS: Email notification preferences for inquiries, messages, and system alerts
- DISPLAY PREFERENCES: Default currency, measurement units (feet/meters)
- PRIVACY SETTINGS: Control what information is displayed publicly

### Messaging
- DIRECT MESSAGING: Two-way communication with buyers
- MESSAGE NOTIFICATIONS: Real-time alerts for new messages
- CONVERSATION HISTORY: Full threaded history with each contact
- Integration with the inquiry pipeline

---

## BACKEND & TECHNICAL CAPABILITIES

These features may come up in technical discussions with IT-savvy prospects.

### AI-Powered Features
- Natural language search processing
- Text-to-specs extraction for listing import
- Smart lead scoring based on engagement patterns

### API Access
- RESTful JSON API
- Authentication via API keys (generated in dashboard)
- Read-only on Plus tier, full read/write on Pro
- Endpoints for: listings CRUD, inquiries, analytics, profile management
- Rate-limited to prevent abuse (custom limits on Ultimate tier)

### Security & Data
- HTTPS everywhere
- JWT-based authentication with token expiration
- Role-based access control
- Data encryption at rest and in transit
- GDPR-compliant data handling
- 90-day data retention after cancellation
- Full data export available at any time

### Infrastructure
- Hosted on Render (cloud platform)
- Frontend on Vercel (global CDN for fast page loads)
- PostgreSQL database with automated backups
- Image/media served via CDN
- 99.9% uptime SLA on Ultimate tier

---

## FEATURE AVAILABILITY BY TIER

| Feature | Free | Basic | Plus | Pro | Ultimate |
|---------|------|-------|------|-----|----------|
| Active Listings | 5 | 25 | 75 | Unlimited | Unlimited |
| Search Visibility | Yes | Yes | Yes | Yes | Yes |
| Inquiry Dashboard | Basic | Full | Full | Full | Full |
| Lead Scoring | No | No | Yes | Yes | Yes |
| Team Members | 1 | 3 | Unlimited | Unlimited | Unlimited |
| Webhooks/CRM | No | No | Yes | Yes | Yes |
| API Access | No | No | Read-only | Read/Write | Custom |
| Featured Listings | No | No | Yes | Yes | Yes |
| Analytics | Basic | Basic | Advanced | Advanced | Advanced |
| Support | Community | Email | Priority | Dedicated | Dedicated + SLA |
| Bulk Tools | No | Yes | Yes | Yes | Yes |
| Media Library | 100MB | 1GB | 5GB | 25GB | Custom |
| Custom Domain | No | No | No | No | Yes |

---

Study this guide thoroughly. When a prospect asks "Can it do X?", you should be able to answer immediately with confidence. If something isn't listed here, check with your admin — we're adding features regularly.
"""
}

TIER_COMPARISON_GUIDE = {
    "slug": "tier-comparison-guide",
    "title": "Subscription Tier Comparison & Selling Guide",
    "description": "Understand every tier so you can recommend the perfect fit for each prospect",
    "category": "sales",
    "audience": "sales_rep",
    "order": 4,
    "content": """# Subscription Tier Comparison & Selling Guide

## Overview

YachtVersal offers 5 tiers designed to serve dealers at every scale. Your job is to match the right tier to each prospect — starting them where they're comfortable and growing them over time.

Remember: Every upgrade increases your recurring commission.

---

## Tier Details

### FREE ($0/month) — Your Commission: $0

Who it's for: Private sellers, curious brokers evaluating the platform, or anyone you want to "land" before "expanding."

What they get:
- 5 active listings
- Basic search visibility
- Email-only inquiries
- No team, no API, no webhooks, no analytics
- Self-service only (no support beyond docs)

Selling strategy:
- Use Free as a "foot in the door" for skeptical prospects
- "Start free, see real results, then we'll talk about upgrading"
- Once they have listings getting views, upgrading is a natural conversation

### BASIC ($29/month) — Your Commission: $2.90/month

Who it's for: Independent brokers, small shops with 10-25 boats, yacht brokers who work alone or with a small team.

What they get:
- 25 active listings
- Full messaging and inquiry dashboard
- Lead stage tracking (basic pipeline)
- Team management (up to 3 members)
- Basic analytics
- Email support

Selling strategy:
- This is your bread-and-butter tier for small operations
- Lead with: "For less than $1/day, you get a professional listing platform with a built-in CRM"
- Focus on: time savings, professional appearance, organized inquiries

Upgrade trigger (Basic → Plus):
- They hit the 25-listing limit
- They want CRM integration
- They're growing their team past 3 people
- They want featured listings

### PLUS ($59/month) — Your Commission: $5.90/month

Who it's for: Growing dealerships with 25-75 boats, tech-savvy operations that use CRM systems.

What they get:
- 75 active listings
- Everything in Basic, plus:
- Webhook delivery to CRM/DMS
- Read-only API access
- Unlimited team members
- Featured listing eligibility
- Advanced lead scoring
- Priority email support

Selling strategy:
- Lead with the CRM integration — this is the #1 reason dealers upgrade from Basic
- "Your leads go directly into HubSpot/GoHighLevel/Salesforce. No manual entry."
- Show the webhook test feature during your demo

Upgrade trigger (Plus → Pro):
- They exceed 75 listings
- They need read/write API (for automated listing feeds from their DMS)
- They want a dedicated account manager
- They have complex multi-location operations

### PRO ($99/month) — Your Commission: $9.90/month

Who it's for: Large dealer groups, multi-location Marina operations, professionally managed brokerages with 75+ boats.

What they get:
- Unlimited listings
- Everything in Plus, plus:
- Full read/write API
- Custom integration support
- Dedicated account manager
- Advanced analytics and reporting
- 25GB media storage

Selling strategy:
- This is a consultative sale — you're talking to operations managers, IT directors, or owners
- Lead with: "Unlimited scale. Full API for your tech stack. Dedicated support."
- Schedule a technical call with their IT team to discuss API integration
- Use case studies and ROI calculations

### ULTIMATE (Custom Pricing) — Your Commission: Custom (negotiated per deal)

Who it's for: Enterprise brokerages, franchise dealer groups with 500+ boats, international operations.

What they get:
- Everything in Pro, plus:
- White-label options
- Custom API rate limits
- Dedicated infrastructure
- SLA guarantees
- Custom feature development
- Custom onboarding and training

Selling strategy:
- Qualify carefully — these are 6-figure annual deals
- Loop in your admin/sales manager early
- Expect a multi-stakeholder sales process
- Be prepared for security audits, legal review, and procurement processes
- Think months not days for the sales cycle

---

## Price-to-Value Talking Points

### Basic ($29/month)
"That's less than a single classified ad on most platforms. And you get 25 listings plus a CRM."

### Plus ($59/month)
"If one extra qualified lead per month turns into a sale, you've paid for 10 years of YachtVersal in one day."

### Pro ($99/month)
"For less than what you'd pay a part-time admin assistant per day, you get unlimited listings, full API, and a dedicated account manager."

---

## Common Tier Questions

Q: "Can I switch tiers?"
A: "Yes, upgrade or downgrade anytime. Changes take effect immediately. If you downgrade and have more listings than the new tier allows, you'll need to archive some — but nothing gets deleted."

Q: "Do you offer annual pricing?"
A: "Contact your admin for annual discount options. Many dealers save 15-20% by paying annually."

Q: "Is there a setup fee?"
A: "No. Zero setup fees. You pay your first month and you're live."

Q: "What payment methods do you accept?"
A: "All major credit cards and debit cards via Stripe. Invoice billing is available for Ultimate tier."

---

## Upsell Playbook

Getting dealers to upgrade is where your commission really grows. Here are natural upsell triggers:

| Current Tier | Trigger Event | Recommended Action |
|---|---|---|
| Free | First inquiry received | "See? Buyers are finding you. Basic gives you a proper CRM to track these leads." |
| Free | Hit 5-listing limit | "You need more room. Basic gives you 25 listings for $29/month." |
| Basic | Hit 25-listing limit | "Your inventory outgrew Basic. Plus gives you 75 listings and CRM integration for $30 more." |
| Basic | Team growing past 3 | "Plus has unlimited team members — scale your team without restrictions." |
| Plus | Asking about API | "Pro gives you full read/write API access for automated inventory sync." |
| Plus | Hit 75-listing limit | "Time for Pro — unlimited listings and a dedicated account manager." |
| Pro | Multi-location needs | "Let's talk about Ultimate for white-label and custom infrastructure." |

---

Use this guide when qualifying prospects. The right tier match means faster closes and happier customers who stay longer.
"""
}

QUICK_REFERENCE_CARD = {
    "slug": "quick-reference-card",
    "title": "Quick Reference Card",
    "description": "At-a-glance reference for key numbers, links, and talking points",
    "category": "sales",
    "audience": "sales_rep",
    "order": 5,
    "content": """# Sales Quick Reference Card

## Pricing At a Glance

| Tier | Price | Listings | Key Feature | Your Commission |
|------|-------|----------|-------------|----------------|
| Free | $0/mo | 5 | Basic visibility | $0 |
| Basic | $29/mo | 25 | Inquiry dashboard + team (3) | $2.90/mo |
| Plus | $59/mo | 75 | CRM webhooks + unlimited team | $5.90/mo |
| Pro | $99/mo | Unlimited | Full API + dedicated support | $9.90/mo |
| Ultimate | Custom | Unlimited | Custom SLA | Custom |

---

## Top 10 Selling Points (Memorize These)

1. ALL-IN-ONE PLATFORM — Listings, CRM, analytics, messaging, team management in one tool
2. AI-POWERED SEARCH — Buyers describe what they want in plain language and find matching boats
3. AI TEXT IMPORT — Paste any listing text and AI extracts all specs automatically
4. FLAT PRICING — No per-listing fees, no sales commission. One monthly rate.
5. CRM INTEGRATION — Push leads to HubSpot, GoHighLevel, Salesforce, Zoho, or custom webhook
6. LEAD SCORING — Hot/warm/cold scoring so reps call the best leads first
7. 40+ SPEC FIELDS — The most detailed listing format in the industry
8. TEAM MANAGEMENT — Roles, permissions, and performance tracking
9. MOBILE-OPTIMIZED — Full dashboard and search on any device
10. 90-DAY DATA RETENTION — Cancel risk-free, reactivate without losing data

---

## Killer Stats to Quote

- "Average listing creation time: under 5 minutes (under 2 with AI import)"
- "Dealers see an average 3x increase in qualified inquiries vs. single-platform listing"
- "Average response time drops from hours to minutes with our unified inbox"
- "Zero sales commission — dealers keep 100% of their sale price"
- "6 built-in CRM integrations — no middleware, no Zapier, no custom code"

---

## Quick Objection Responses

"Too expensive" → "One lead pays for a year of Basic. Most dealers get 5-10 leads in month one."
"No time" → "Setup takes 30 minutes. AI import does your data entry."
"Already on Boat Trader" → "Keep it. YachtVersal adds another buyer channel plus the CRM you don't have."
"Need to ask my boss" → "Let's schedule a 15-minute demo so they can see it live."
"We have a website" → "Your site handles branding. We handle lead generation and management."

---

## Key Differentiators vs. Competition

| Us | Them |
|----|------|
| Flat monthly fee | Per-listing charges |
| Built-in CRM | CRM is extra or nonexistent |
| AI search + AI import | Standard keyword search only |
| 6 CRM integrations included | Requires Zapier or custom dev |
| Team management included | Single-user or extra fee |
| Zero sales commission | Take a cut of your sales |
| 40+ spec fields | Basic specs only |
| 90-day data retention after cancel | Data deleted immediately |

---

## Demo Checklist (Before Every Call)

- [ ] Demo account loaded and working (check Demo Portal tab)
- [ ] Screen sharing software tested
- [ ] Know the prospect's name, company, and approximate inventory size
- [ ] Have their current platforms/pain points noted
- [ ] Know which tier you'll recommend
- [ ] Have your referral link or deal code ready to share at the end

---

## Commission Calculator

| # of Dealers | Avg Tier | Your Monthly Commission |
|---|---|---|
| 5 | Basic ($29) | $14.50/mo |
| 10 | Basic ($29) | $29.00/mo |
| 10 | Plus ($59) | $59.00/mo |
| 20 | Mix (avg $50) | $100.00/mo |
| 50 | Mix (avg $60) | $300.00/mo |
| 100 | Mix (avg $65) | $650.00/mo |

This is PASSIVE RECURRING INCOME. Build your portfolio and it pays you every month.

---

Keep this reference handy during calls. Know the numbers, know the talking points, and always have a next step ready.
"""
}

DEFAULT_DOCS = [DEMO_ACCOUNT_GUIDE, SALES_GUIDE, PLATFORM_FEATURES_GUIDE, TIER_COMPARISON_GUIDE, QUICK_REFERENCE_CARD]


def get_default_doc_by_slug(slug: str):
    """Get default doc content by slug."""
    for doc in DEFAULT_DOCS:
        if doc["slug"] == slug:
            return doc
    return None
