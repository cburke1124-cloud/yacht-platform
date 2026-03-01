export const Config = {
  API_BASE_URL: process.env.EXPO_PUBLIC_API_URL ?? 'https://yacht-platform.onrender.com',
  APP_NAME: 'YachtVersal',
  SUPPORT_EMAIL: 'support@yachtversal.com',
  TERMS_URL: 'https://yachtversal.com/terms',
  PRIVACY_URL: 'https://yachtversal.com/privacy',
} as const;
