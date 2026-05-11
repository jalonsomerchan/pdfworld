export type AnalyticsEventName = 'tool_opened' | 'tool_completed' | 'tool_error' | 'pwa_installed' | 'offline_ready' | 'page_view';

export type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

const ENABLED = import.meta.env.PUBLIC_PRIVACY_ANALYTICS === 'true';
const ENDPOINT = import.meta.env.PUBLIC_PRIVACY_ANALYTICS_ENDPOINT;
const SAFE_KEY = /^[a-z0-9_:-]+$/i;
const SAFE_VALUE = /^[a-z0-9_:/.-]+$/i;
const ALLOWED_KEYS = new Set([
  'tool_id',
  'category',
  'status',
  'error_type',
  'route',
  'lang',
  'offline',
  'installed',
]);
const BLOCKED_KEYS = new Set([
  'file',
  'files',
  'filename',
  'file_name',
  'name',
  'pdf',
  'content',
  'text',
  'metadata',
  'pages',
  'password',
  'title',
  'author',
]);

export function sanitizeAnalyticsPayload(payload: AnalyticsPayload = {}) {
  return Object.fromEntries(
    Object.entries(payload)
      .filter(([key, value]) => {
        if (!SAFE_KEY.test(key)) return false;
        if (BLOCKED_KEYS.has(key)) return false;
        if (!ALLOWED_KEYS.has(key)) return false;
        if (!['string', 'number', 'boolean'].includes(typeof value)) return false;
        if (typeof value === 'string') return SAFE_VALUE.test(value.trim());
        return true;
      })
      .map(([key, value]) => [key, typeof value === 'string' ? value.trim().slice(0, 80) : value]),
  );
}

export function buildPrivacyAnalyticsEvent(event: AnalyticsEventName, payload: AnalyticsPayload = {}) {
  return {
    event,
    payload: sanitizeAnalyticsPayload(payload),
    path: typeof window === 'undefined' ? undefined : window.location.pathname,
    lang: typeof document === 'undefined' ? undefined : document.documentElement.lang || 'es',
    timestamp: new Date().toISOString(),
  };
}

export function trackPrivacyEvent(event: AnalyticsEventName, payload: AnalyticsPayload = {}) {
  if (!ENABLED || !ENDPOINT || typeof navigator === 'undefined') return false;

  const body = JSON.stringify(buildPrivacyAnalyticsEvent(event, payload));

  try {
    if (navigator.sendBeacon) {
      return navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
    }

    void fetch(ENDPOINT, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    });
    return true;
  } catch {
    // Analytics must never affect PDF tools or user flow.
    return false;
  }
}

export function trackToolOpened(toolId: string, category?: string) {
  return trackPrivacyEvent('tool_opened', { tool_id: toolId, category });
}

export function trackToolCompleted(toolId: string, category?: string) {
  return trackPrivacyEvent('tool_completed', { tool_id: toolId, category });
}

export function trackToolError(toolId: string, errorType = 'unknown') {
  return trackPrivacyEvent('tool_error', { tool_id: toolId, error_type: errorType });
}
