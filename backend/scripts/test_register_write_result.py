from fastapi.testclient import TestClient
import sys
sys.path.insert(0, r'c:\Users\cburk\yacht-platform\backend')
import main
import json

client = TestClient(main.app)
resp = client.post('/api/auth/register', json={
    "email": "cburke+test@yachtversal.com",
    "password": "admin123",
    "first_name": "Christopher",
    "last_name": "Burke",
    "phone": "5043909829",
    "user_type": "admin",
    "company_name": "YachtVersal",
    "subscription_tier": "free"
})
out = {'status_code': resp.status_code, 'body': None}
try:
    out['body'] = resp.json()
except Exception as e:
    out['body'] = resp.text
with open('scripts/test_register_result.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, indent=2)
print('wrote scripts/test_register_result.json')
