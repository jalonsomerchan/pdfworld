type AnalyticsEventName = 'tool_opened' | 'tool_completed' | 'tool_error' | 'pwa_installed' | 'offline_ready';

type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

const ENABLED = import.meta.env.PUBLIC_PRIVACY_ANALYTICS === 'true';
const ENDPOINT = import.meta.env.PUBLIC_PRIVACY_ANALYTICS_ENDPOINT;
const SAFE_KEY = /^[a-z0-9_:-]+$/i;

function sanitizePayload(payload: AnalyticsPayload = {}) {
  return Object.fromEntries(
    Object.entries(payload)
      .filter(([key, value]) => SAFE_KEY.test(key) && ['string', 'number', 'boolean'].includes(typeof value))
      .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 80) : value]),
  );
}

export function trackPrivacyEvent(event: AnalyticsEventName, payload: AnalyticsPayload = {}) {
  if (!ENABLED || !ENDPOINT || typeof navigator === 'undefined') return;

  const body = JSON.stringify({
    event,
    payload: sanitizePayload(payload),
    path: window.location.pathname,
    lang: document.documentElement.lang || 'es',
    timestamp: new Date().toISOString(),
  });

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
      return;
    }

    void fetch(ENDPOINT, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    });
  } catch {
    // Analytics must never affect PDF tools or user flow.
  }
}

export function trackToolOpened(toolId: string) {
  trackPrivacyEvent('tool_opened', { tool_id: toolId });
}

export function trackToolCompleted(toolId: string) {
  trackPrivacyEvent('tool_completed', { tool_id: toolId });
}

export function trackToolError(toolId: string, errorType = 'unknown') {
  trackPrivacyEvent('tool_error', { tool_id: toolId, error_type: errorType });
}
