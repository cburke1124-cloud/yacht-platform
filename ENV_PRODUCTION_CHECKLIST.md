# Production Environment Checklist

This checklist maps your current env setup to production hosting targets and flags what must be changed before launch.

## Frontend (Vercel)

Set these in Vercel Project Settings → Environment Variables.

| Variable | Required | Current State | Production Action |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Localhost URL | Set to `https://api.yourdomain.com/api` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | If Stripe checkout enabled | Test key placeholder | Replace with live publishable key |

## Backend (Render/Railway)

Set these in backend service environment settings.

| Variable | Required | Current State | Production Action |
|---|---|---|---|
| `DATABASE_URL` | Yes | Local Postgres URL | Set managed production Postgres URL |
| `SECRET_KEY` | Yes | Weak/placeholder values present | Replace with long random secret (>= 32 chars) |
| `BASE_URL` | Yes | Duplicated and includes localhost value | Keep one value only, set to `https://yachtversal.com` |
| `SENDGRID_API_KEY` | Yes (email features) | Placeholder currently set | Replace with real SendGrid key |
| `FROM_EMAIL` | Yes (email features) | Present | Keep/confirm verified sender in SendGrid |
| `STRIPE_SECRET_KEY` | If billing enabled | Test key placeholder | Replace with live secret key |
| `STRIPE_WEBHOOK_SECRET` | If billing enabled | Placeholder | Set live webhook secret from Stripe endpoint |
| `STRIPE_PRICE_BASIC` | If billing enabled | Placeholder | Set live price ID |
| `STRIPE_PRICE_PREMIUM` | If billing enabled | Placeholder | Set live price ID |
| `ALGORITHM` | Recommended | Present (`HS256`) | Keep as `HS256` unless intentionally changed |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Recommended | Present | Keep or tune for your auth policy |
| `LOG_LEVEL` | Recommended | INFO | Keep `INFO` for production |
| `ENVIRONMENT` | Recommended | development | Set to `production` |
| `RATE_LIMIT_ENABLED` | Recommended | true | Keep enabled |
| `RATE_LIMIT_PER_MINUTE` | Optional tuning | 200 | Tune based on traffic and abuse patterns |
| `CLAUDE_API_KEY` | If AI features enabled | Present | Move to production secret store |
| `HCAPTCHA_SECRET` | If captcha enabled | Placeholder | Set real secret |
| `HCAPTCHA_SITEKEY` | If captcha enabled (frontend also) | Placeholder | Set real site key |
| `GOOGLE_MAPS_API_KEY` | If maps enabled | Placeholder | Set real key with domain restrictions |

## Media Storage (Backend)

Required only if you want object storage instead of local disk.

| Variable | Required | Production Action |
|---|---|---|
| `MEDIA_STORAGE_BACKEND` | Yes (for object storage) | Set `s3` |
| `S3_ENDPOINT_URL` | Yes | Set provider endpoint (R2/B2/S3) |
| `S3_BUCKET` | Yes | Set bucket name |
| `S3_REGION` | Yes | Set bucket region |
| `S3_ACCESS_KEY_ID` | Yes | Set access key |
| `S3_SECRET_ACCESS_KEY` | Yes | Set secret key |
| `S3_PUBLIC_BASE_URL` | Recommended | Set public CDN/base URL for media |
| `S3_PREFIX` | Optional | Set prefix like `uploads` |
| `S3_OBJECT_ACL` | Optional | Default is `public-read` |

## Video Optimization Dependency

To activate server-side video compression/thumbnails, backend runtime needs:

- `ffmpeg` installed and available in PATH

Without ffmpeg, uploads still work and safely fall back to original video files.

## Cleanup Needed Before Go-Live

- Remove duplicate keys from `backend/.env` (`SECRET_KEY`, `BASE_URL` each appear twice).
- Remove localhost/development values from production environment.
- Ensure no real secrets are committed to repo.
- Rotate any secret/API key that was ever stored in plaintext in repository history.

## Quick Verification After Setting Vars

1. Deploy backend, then hit health endpoint.
2. Deploy frontend and verify API calls use production URL.
3. Test registration/login and password reset.
4. Test Stripe checkout/webhook flow (if enabled).
5. Upload image and video; confirm optimized media URLs are returned.
6. Trigger an email event and confirm SendGrid delivery.
