export const normalizeHandle = (value?: string | null): string => {
  const raw = (value || '').trim();
  if (!raw) return 'user';
  return raw.replace(/^@+/, '').replace(/\s+/g, '_').toLowerCase();
};

export const toHandle = (value?: string | null): string => `@${normalizeHandle(value)}`;
