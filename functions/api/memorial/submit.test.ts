import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateSubmission,
  sanitizeMarkdown,
  buildIssuePayload,
  corsHeaders,
  onRequestPost,
  resetRateLimitsForTest
} from './submit';

describe('validateSubmission', () => {
  it('accepts a valid submission without contactEmail', () => {
    const res = validateSubmission({
      entryNumber: 42,
      humanity: '  A teacher who kept notebooks for every student  ',
      relationship: 'family',
      age: 34,
      region: 'Gaza',
      photoUrl: 'https://example.com/photo.jpg'
    });
    expect(res).toEqual({
      ok: true,
      data: {
        entryNumber: 42,
        humanity: 'A teacher who kept notebooks for every student',
        relationship: 'family',
        age: 34,
        region: 'Gaza',
        photoUrl: 'https://example.com/photo.jpg'
      }
    });
  });

  it('rejects whitespace-only humanity strings', () => {
    expect(
      validateSubmission({
        humanity: '               ',
        relationship: 'friend',
        region: 'Lebanon'
      }).ok
    ).toBe(false);
  });

  it('enforces allowlists on relationship and region', () => {
    expect(
      validateSubmission({
        humanity: 'A baker who opened before dawn every morning',
        relationship: 'arbitrary-value',
        region: 'Gaza'
      }).ok
    ).toBe(false);
    expect(
      validateSubmission({
        humanity: 'A baker who opened before dawn every morning',
        relationship: 'friend',
        region: 'Mars'
      }).ok
    ).toBe(false);
  });

  it('rejects out-of-range age and non-http photo URLs', () => {
    expect(
      validateSubmission({
        humanity: 'A baker who opened before dawn every morning',
        relationship: 'friend',
        region: 'Israel',
        age: -5
      }).ok
    ).toBe(false);
    expect(
      validateSubmission({
        humanity: 'A baker who opened before dawn every morning',
        relationship: 'friend',
        region: 'Israel',
        photoUrl: 'javascript:alert(1)'
      }).ok
    ).toBe(false);
  });
});

describe('sanitizeMarkdown & buildIssuePayload', () => {
  it('neutralizes GitHub @mentions and Markdown control characters', () => {
    const safe = sanitizeMarkdown(
      'Hello @octocat\n# Heading [link](https://evil.test)'
    );
    expect(safe).not.toContain('@octocat');
    expect(safe).not.toContain('\n');
    expect(safe).toContain('(at)octocat');
  });

  it('never embeds email addresses or contact fields in the GitHub issue', () => {
    const payload = buildIssuePayload(
      {
        entryNumber: 7,
        humanity: 'A nurse who worked double shifts at the clinic',
        relationship: 'colleague',
        age: 29,
        region: 'Gaza',
        photoUrl: null
      },
      '2026-11-21T00:00:00.000Z'
    );
    expect(payload.body).not.toContain('Submitted by:');
    expect(payload.title).toContain('#7');
  });
});

describe('corsHeaders & onRequestPost', () => {
  beforeEach(() => {
    resetRateLimitsForTest();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('restricts CORS origin instead of returning wildcard *', () => {
    expect(
      corsHeaders('https://evil.example')['Access-Control-Allow-Origin']
    ).toBe('https://monitor-the-war.pages.dev');
    expect(
      corsHeaders('http://localhost:3000')['Access-Control-Allow-Origin']
    ).toBe('http://localhost:3000');
  });

  it('ignores legacy contactEmail field and does not publish it to GitHub', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          number: 99,
          html_url: 'https://github.com/test/99'
        }),
        { status: 201 }
      )
    );

    const res = await onRequestPost({
      request: new Request(
        'https://monitor-the-war.pages.dev/api/memorial/submit',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: 'https://monitor-the-war.pages.dev',
            'CF-Connecting-IP': '198.51.100.10'
          },
          body: JSON.stringify({
            humanity: 'A doctor who stayed with his patients through the night',
            relationship: 'colleague',
            region: 'Gaza',
            contactEmail: 'private@example.com'
          })
        }
      ),
      env: { GITHUB_TOKEN: 'ghp_test' }
    } as Parameters<typeof onRequestPost>[0]);

    expect(res.status).toBe(201);
    const sentBody = String(fetchMock.mock.calls[0]?.[1]?.body ?? '');
    expect(sentBody).not.toContain('private@example.com');
  });
});
