# Yacht Platform Deployment Runbook

This guide starts your upload process with your domain at DreamHost and a cost-efficient production setup.

## Recommended Production Topology

- **Frontend (Next.js):** Vercel
- **Backend (FastAPI):** Render (or Railway)
- **Database:** Managed Postgres (Render Postgres / Railway / Neon)
- **Media files:** S3-compatible storage (Cloudflare R2, Backblaze B2, or AWS S3)
- **DNS/domain:** Keep registrar at DreamHost and point DNS to hosting providers

This split is usually cheaper and easier than running everything on one VPS.

## Cloudflare Alternatives (Cost-Focused)

If you want alternatives to Cloudflare for CDN/WAF/DNS features:

1. **Bunny.net**: very low-cost CDN, simple setup, excellent media delivery pricing.
2. **Fastly (starter usage)**: powerful, but usually more complex and often pricier at scale.
3. **AWS CloudFront + Route53**: flexible but more ops overhead.
4. **No CDN initially**: use Vercel edge for frontend and only add CDN later for media if traffic grows.

For your current stage, **Bunny.net + DreamHost DNS** is often the most affordable straightforward option if you do not want Cloudflare.

## What Was Optimized in Code

Backend media uploads now do the following:

- Images are auto-rotated via EXIF, resized, and compressed to **WebP**.
- Image thumbnails are generated as **WebP**.
- Video uploads attempt ffmpeg optimization to **MP4 (H.264/AAC)** with `+faststart`.
- Video thumbnail extraction is attempted (graceful fallback if ffmpeg is unavailable).
- If optimization fails, original upload is preserved instead of blocking upload.

Files updated:
- `backend/app/api/routes_media.py`
- `backend/requirements.txt`

## Prerequisites

- DreamHost access (DNS management)
- Vercel account
- Render or Railway account
- Production Postgres database
- SendGrid API key (already integrated in backend)
- Optional: ffmpeg installed on backend host for video compression

## FFmpeg Installation

### Local Windows (already done in your environment)

```powershell
winget install -e --id Gyan.FFmpeg
```

If your current terminal does not detect `ffmpeg` immediately, open a new terminal window.

### Render / Railway

- If using Docker deployment, include ffmpeg in your image:

```dockerfile
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*
```

- If not using Docker, choose a build/start environment that supports system package installation, or migrate backend deploy to a Docker-based service.

### Ubuntu/Debian VPS

```bash
sudo apt-get update
sudo apt-get install -y ffmpeg
ffmpeg -version
```

## Step 1: Deploy Backend (Render example)

1. Create a new **Web Service** from your backend repo folder.
2. Build command:
   - `pip install -r requirements.txt`
3. Start command:
   - `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Set environment variables (minimum):
   - `DATABASE_URL`
   - `SECRET_KEY`
   - `SENDGRID_API_KEY`
   - `FROM_EMAIL`
   - `APP_ENV=production`
   - `CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com`
5. Add media storage vars if using object storage:
   - `MEDIA_STORAGE_BACKEND=s3`
   - `S3_BUCKET`
   - `S3_REGION`
   - `S3_ENDPOINT_URL` (for R2/B2)
   - `S3_ACCESS_KEY_ID`
   - `S3_SECRET_ACCESS_KEY`
   - `S3_PUBLIC_BASE_URL`
   - Optional: `S3_PREFIX`, `S3_OBJECT_ACL`
6. If Render plan supports it, install ffmpeg or use a base image that includes ffmpeg.

## Step 2: Deploy Frontend (Vercel)

1. Import the frontend project in Vercel.
2. Set framework to Next.js (auto-detected).
3. Add frontend env vars:
   - `NEXT_PUBLIC_API_URL=https://api.yourdomain.com`
   - Any Stripe/public keys used by frontend.
4. Deploy and validate app pages and auth flows.

## Step 3: Connect DreamHost Domain

1. In Vercel, add `yourdomain.com` and `www.yourdomain.com`.
2. In backend provider, add `api.yourdomain.com`.
3. In DreamHost DNS:
   - Point root/`www` records to Vercel targets.
   - Point `api` record to backend provider target.
4. Wait for DNS propagation and verify HTTPS certificates are issued.

## Step 4: Production Checks

1. Open frontend and verify login/register.
2. Create/edit a listing.
3. Upload image and video assets.
4. Confirm email notifications send (invites/messages/reset flows).
5. Confirm admin dashboard loads and critical tabs work.
6. Verify CORS and mixed-content issues are absent.

## Step 5: Performance + Cost Controls

- Enable object storage lifecycle rules for old/unreferenced media.
- Cache static assets via CDN headers.
- Monitor video sizes; if needed, tighten ffmpeg `-crf` from `28` to `30` for more compression.
- Add CDN only to media domain first (highest bandwidth savings).

## Quick Launch Sequence

1. Deploy backend and database.
2. Deploy frontend and point to backend API URL.
3. Configure DreamHost DNS.
4. Validate uploads/emails/auth.
5. Enable CDN for media if needed.
