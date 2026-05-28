// Single source of truth for cross-origin allowlisting.
export const ALLOWED_ORIGINS = [
  'https://javelinfund.ca',
  'https://www.javelinfund.ca',
  'https://javelinfund-web.sakibsadmanshajib.workers.dev',
  'https://javelinfund-web.pages.dev',
  'http://localhost:4321',
];

export function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (origin.endsWith('.javelinfund-web.pages.dev')) return true;
  return false;
}

// Returns the origin if allowlisted, else '' (for CORS echo).
export function allowOrigin(origin) {
  return isAllowedOrigin(origin) ? origin : '';
}
