// Brand palette — mirrors Figma/web
export const Colors = {
  primary: '#10214F',
  accent: '#01BBDC',
  accentDark: '#0199B8',
  white: '#FFFFFF',
  background: '#F8F9FC',
  surface: '#FFFFFF',
  border: '#DBDBDB',
  borderLight: '#F0F0F0',
  muted: '#6B7280',
  mutedLight: '#9CA3AF',
  text: '#111827',
  textSecondary: '#374151',
  danger: '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',
  overlay: 'rgba(0,0,0,0.45)',
  shimmer: '#E5E7EB',
} as const;

export type ColorKey = keyof typeof Colors;
