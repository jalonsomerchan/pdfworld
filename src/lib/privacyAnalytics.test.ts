import { describe, expect, it } from 'vitest';
import { buildPrivacyAnalyticsEvent, sanitizeAnalyticsPayload } from './privacyAnalytics';

describe('sanitizeAnalyticsPayload', () => {
  it('keeps only allowlisted generic analytics fields', () => {
    expect(
      sanitizeAnalyticsPayload({
        tool_id: 'merge-pdf',
        category: 'organizar',
        status: 'completed',
        random: 'ignored',
      }),
    ).toEqual({
      tool_id: 'merge-pdf',
      category: 'organizar',
      status: 'completed',
    });
  });

  it('drops file names, content, metadata and unsafe values', () => {
    expect(
      sanitizeAnalyticsPayload({
        filename: 'factura-personal.pdf',
        file_name: 'dni.pdf',
        content: 'private pdf text',
        metadata: 'author data',
        password: 'secret',
        tool_id: 'merge pdf with spaces',
        error_type: 'password',
      }),
    ).toEqual({ error_type: 'password' });
  });

  it('keeps booleans and numbers only for safe keys', () => {
    expect(sanitizeAnalyticsPayload({ offline: true, installed: false, pages: 10 })).toEqual({
      offline: true,
      installed: false,
    });
  });
});

describe('buildPrivacyAnalyticsEvent', () => {
  it('builds a safe event object without leaking blocked payload fields', () => {
    const event = buildPrivacyAnalyticsEvent('tool_error', {
      tool_id: 'compress-pdf',
      error_type: 'memory',
      filename: 'secret.pdf',
    });

    expect(event.event).toBe('tool_error');
    expect(event.payload).toEqual({ tool_id: 'compress-pdf', error_type: 'memory' });
    expect(event.timestamp).toEqual(expect.any(String));
  });
});
