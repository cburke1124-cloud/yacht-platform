import * as Sentry from '@sentry/nextjs';

// SENTRY_DSN is unset today — Sentry.init() with an empty dsn is a documented
// no-op, so this safely does nothing until a real DSN is supplied.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
