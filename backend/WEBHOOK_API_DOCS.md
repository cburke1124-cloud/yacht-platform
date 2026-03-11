"""
YachtVersal Lead Delivery & CRM Integration API

This documentation covers the public APIs for lead submission and webhook configuration.

## Public Endpoints

### POST /inquiries
Submit a new yacht inquiry (lead) from a buyer.
**Authentication:** Not required

**Request Body:**
```json
{
  "sender_name": "John Smith",
  "sender_email": "john@example.com",
  "sender_phone": "+1-555-123-4567",  // optional
  "message": "I'm interested in viewing this yacht",
  "listing_id": 42
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "inquiry_id": 123,
  "message": "Inquiry created successfully"
}
```

**Automatic Actions:**
- Inquiry record created and stored in database
- If dealer has webhook configured → lead sent to dealer's webhook URL
- Webhook sent with HMAC-SHA256 signature for verification


### POST /inquiries (Webhook Payload)
**Format:** JSON (default) or ADF XML (if dealer configured)

**JSON Payload Example:**
```json
{
  "inquiry_id": 123,
  "inquiry_type": "boat_inquiry",
  "timestamp": "2026-03-11T15:30:45.123456",
  "contact": {
    "name": "John Smith",
    "email": "john@example.com",
    "phone": "+1-555-123-4567"
  },
  "message": "I'm interested in viewing this yacht",
  "listing": {
    "id": 42,
    "title": "2023 Sea Ray Sundancer 350",
    "year": 2023,
    "make": "Sea Ray",
    "model": "Sundancer 350",
    "price": 850000
  }
}
```

**ADF XML Payload Example:**
```xml
<adf>
  <prospect>
    <request type="leadstatus">
      <qualifier name="new"/>
    </request>
    <contact type="lead">
      <name part="full">John Smith</name>
      <email preferredcontact="true">john@example.com</email>
      <phone>+1-555-123-4567</phone>
    </contact>
    <vehicle interest="buy" status="active">
      <year>2023</year>
      <make>Sea Ray</make>
      <model>Sundancer 350</model>
      <notes>2023 Sea Ray Sundancer 350 - Luxury Motor Yacht</notes>
      <price type="asking">850000</price>
      <vin>YACHT-42</vin>
    </vehicle>
    <comments>
      <message>I'm interested in viewing this yacht</message>
    </comments>
    <datetime>2026-03-11T15:30:45.123456</datetime>
  </prospect>
</adf>
```

## Webhook Security

All webhooks are signed using HMAC-SHA256 for verification.

**Webhook Headers:**
- `X-Webhook-Timestamp`: Unix timestamp of send time
- `X-Webhook-Signature`: `sha256=<hmac_hex>`
- `Content-Type`: `application/json` or `application/xml`
- Custom auth headers if configured (X-API-Key, Authorization, etc.)

**Signature Verification (Node.js Example):**
```javascript
const crypto = require('crypto');

function verifyWebhookSignature(rawBody, signature, secret) {
  const [algo, hash] = signature.split('=');
  const timestamp = req.headers['x-webhook-timestamp'];
  const payload = `${timestamp}.${rawBody}`;
  const computed = crypto.createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(hash, computed);
}
```

**Signature Verification (Python Example):**
```python
import hmac
import hashlib

def verify_webhook_signature(raw_body, signature, secret):
    algo, hash_value = signature.split('=')
    timestamp = request.headers['X-Webhook-Timestamp']
    payload = f"{timestamp}.{raw_body}"
    computed = hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(hash_value, computed)
```

## Webhook Retry Policy

- **Max Retries:** 3 (configurable via WEBHOOK_MAX_RETRIES env var)
- **Backoff:** Exponential (delay * 2^retry_count)
- **Timeout:** 10 seconds per attempt (configurable via WEBHOOK_TIMEOUT)
- **Trigger Conditions:** Server errors (5xx), timeouts, or network issues
- **Final Failure:** After max retries, logged in webhook_logs table with error message

## Dealer Configuration Endpoints

### GET /webhooks/config
Retrieve dealer's webhook configuration.
**Authentication:** Required (dealer bearer token)

**Response:**
```json
{
  "id": 5,
  "webhook_url": "https://your-dms.com/webhook/leads",
  "format_type": "json",
  "auth_type": "api_key",
  "enabled": true,
  "test_passed": true,
  "last_webhook_sent": "2026-03-11T14:30:00",
  "total_webhooks_sent": 42,
  "webhook_failures": 1
}
```

### POST /webhooks/config
Create or update webhook configuration.
**Authentication:** Required

**Request Body:**
```json
{
  "webhook_url": "https://your-dms.com/webhook/leads",
  "format_type": "json",           // "json" or "adf_xml"
  "auth_type": "api_key",          // "none", "api_key", "bearer", "basic"
  "auth_token": "your-api-key"     // optional if auth_type is "none"
}
```

### POST /webhooks/test
Send a test webhook to verify configuration.
**Authentication:** Required

**Response (Success):**
```json
{
  "success": true,
  "status_code": 200,
  "message": "Test webhook delivered successfully"
}
```

### GET /webhooks/logs
Retrieve webhook delivery history.
**Authentication:** Required

**Response:**
```json
[
  {
    "id": 1234,
    "inquiry_id": 123,
    "success": true,
    "status_code": 200,
    "error_message": null,
    "retry_count": 0,
    "sent_at": "2026-03-11T15:30:45.123456"
  },
  {
    "id": 1233,
    "inquiry_id": 122,
    "success": false,
    "status_code": 503,
    "error_message": "Service unavailable",
    "retry_count": 2,
    "sent_at": "2026-03-11T15:25:30.123456"
  }
]
```

### DELETE /webhooks/config
Remove webhook configuration.
**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "message": "Webhook configuration deleted"
}
```

## CRM Integration Endpoints

### GET /crm/integrations
List CRM integrations for current user.
**Authentication:** Required

### POST /crm/integrations
Connect a CRM system (HubSpot, Pipedrive, etc.)
**Authentication:** Required

**Supported CRM Types:**
- `hubspot` — HubSpot CRM
- `gohighlevel` — GoHighLevel
- `pipedrive` — Pipedrive Sales CRM
- `zoho` — Zoho CRM
- `activecampaign` — ActiveCampaign
- `salesforce` — Salesforce

### PUT /crm/settings
Update CRM sync settings.
**Authentication:** Required

### DELETE /crm/disconnect
Disconnect current CRM integration.
**Authentication:** Required

## Environment Variables

```
# Webhook configuration
WEBHOOK_SIGNING_SECRET=your-webhook-secret-key-min-32-chars
WEBHOOK_MAX_RETRIES=3                    # max retry attempts
WEBHOOK_TIMEOUT=10                       # seconds per request
WEBHOOK_RETRY_DELAY=60                   # initial delay in seconds
```

## Error Responses

### 400 Bad Request
```json
{
  "detail": "sender_email is required"
}
```

### 401 Unauthorized
```json
{
  "detail": "Not authenticated"
}
```

### 429 Too Many Requests
```json
{
  "detail": "Rate limit exceeded"
}
```

### 500 Internal Server Error
```json
{
  "detail": "Internal server error"
}
```

## Rate Limiting

- **Inquiry submission:** 10 per IP per minute
- **Webhook test:** 5 per dealer per minute
- **Configuration changes:** 30 per dealer per hour

## Data Retention

- **Webhook logs:** 90 days
- **Failed inquiries:** Indefinite (retry until success or manual deletion)

## Support

For issues or questions:
- Email: support@yachtversal.com
- Docs: https://docs.yachtversal.com/webhooks
- Status: https://status.yachtversal.com
"""
