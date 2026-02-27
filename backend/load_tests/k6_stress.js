import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 20 },
    { duration: '5m', target: 50 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<1200'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://staging-api.yourdomain.com';

export default function () {
  const listingRes = http.get(`${BASE_URL}/api/listings`);
  check(listingRes, {
    'GET /api/listings status 200': (res) => res.status === 200,
  });

  const searchRes = http.get(`${BASE_URL}/api/search?query=yacht`);
  check(searchRes, {
    'GET /api/search status 200/404': (res) => res.status === 200 || res.status === 404,
  });

  sleep(1);
}
