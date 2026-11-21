// Cloudflare Pages Function — creates GitHub Issue for memorial submissions
// Env var GITHUB_TOKEN must be set in Cloudflare Pages dashboard.
// Zero PII policy: submissions never collect or forward personal emails.

interface Env {
  GITHUB_TOKEN: string;
}

export interface SubmissionBody {
  entryNumber?: number | null;
  humanity: string;
  relationship: string;
  age?: number | null;
  region: string;
  photoUrl?: string | null;
}

export interface ValidatedSubmission {
  entryNumber: number | null;
  humanity: string;
  relationship: string;
  age: number | null;
  region: string;
  photoUrl: string | null;
}

const REPO = 'Sujaya-Nimneth/Oil-Burn-Tracker';
const CANONICAL_ORIGIN = 'https://monitor-the-war.pages.dev';
const ALLOWED_ORIGINS = new Set([
  CANONICAL_ORIGIN,
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]);

export const ALLOWED_RELATIONSHIPS = new Set([
  'family',
  'friend',
  'neighbor',
  'colleague',
  'community'
]);

export const ALLOWED_REGIONS = new Set([
  'Gaza',
  'West Bank',
  'Lebanon',
  'Israel',
  'Iran'
]);

// Simple in-memory rate limit (best-effort per edge isolate)
const ipHits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string | null): boolean {
  if (!ip) return false;
  const now = Date.now();
  // Evict expired entries so the map cannot grow without bound
  for (const [key, entry] of ipHits) {
    if (now > entry.resetAt) ipHits.delete(key);
  }
  const entry = ipHits.get(ip);
  if (!entry) {
    ipHits.set(ip, { count: 1, resetAt: now + 3600000 });
    return false;
  }
  entry.count++;
  return entry.count > 3;
}

export function resetRateLimitsForTest() {
  ipHits.clear();
}

export function corsHeaders(
  requestOrigin?: string | null
): Record<string, string> {
  const origin =
    requestOrigin && ALLOWED_ORIGINS.has(requestOrigin)
      ? requestOrigin
      : CANONICAL_ORIGIN;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
    'Content-Type': 'application/json'
  };
}

/**
 * Neutralize Markdown formatting, control characters, and GitHub @mentions
 * before embedding user-supplied text in a public GitHub issue.
 */
export function sanitizeMarkdown(input: string): string {
  return input
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/([\\`*_{}[\]()#+\-!<>|])/g, '\\$1')
    .replace(/(^|[^\w])@([a-zA-Z0-9](?:[a-zA-Z0-9-]*))/g, '$1(at)$2')
    .trim();
}

export function validateSubmission(
  raw: unknown
): { ok: true; data: ValidatedSubmission } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Invalid request body.' };
  }
  const body = raw as Record<string, unknown>;

  if (typeof body.humanity !== 'string') {
    return { ok: false, error: 'Description must be 10-280 characters.' };
  }
  const humanity = body.humanity.trim();
  if (humanity.length < 10 || humanity.length > 280) {
    return { ok: false, error: 'Description must be 10-280 characters.' };
  }

  if (
    typeof body.relationship !== 'string' ||
    !ALLOWED_RELATIONSHIPS.has(body.relationship)
  ) {
    return { ok: false, error: 'Please select a valid relationship.' };
  }

  if (typeof body.region !== 'string' || !ALLOWED_REGIONS.has(body.region)) {
    return { ok: false, error: 'Please select a valid region.' };
  }

  let age: number | null = null;
  if (body.age !== null && body.age !== undefined && body.age !== '') {
    if (
      typeof body.age !== 'number' ||
      !Number.isInteger(body.age) ||
      body.age < 0 ||
      body.age > 120
    ) {
      return {
        ok: false,
        error: 'Age must be a whole number between 0 and 120.'
      };
    }
    age = body.age;
  }

  let entryNumber: number | null = null;
  if (body.entryNumber !== null && body.entryNumber !== undefined) {
    if (
      typeof body.entryNumber !== 'number' ||
      !Number.isInteger(body.entryNumber) ||
      body.entryNumber < 1 ||
      body.entryNumber > 10_000_000
    ) {
      return { ok: false, error: 'Invalid entry number.' };
    }
    entryNumber = body.entryNumber;
  }

  let photoUrl: string | null = null;
  if (
    body.photoUrl !== null &&
    body.photoUrl !== undefined &&
    body.photoUrl !== ''
  ) {
    if (typeof body.photoUrl !== 'string' || body.photoUrl.length > 500) {
      return { ok: false, error: 'Photo URL must be a valid http(s) link.' };
    }
    try {
      const parsed = new URL(body.photoUrl.trim());
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('bad protocol');
      }
      photoUrl = parsed.href;
    } catch {
      return { ok: false, error: 'Photo URL must be a valid http(s) link.' };
    }
  }

  return {
    ok: true,
    data: {
      entryNumber,
      humanity,
      relationship: body.relationship,
      age,
      region: body.region,
      photoUrl
    }
  };
}

export function buildIssuePayload(
  data: ValidatedSubmission,
  timestampIso: string
) {
  const entryLabel = data.entryNumber ? `#${data.entryNumber}` : '(unassigned)';
  const safeTitleFragment = data.humanity
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/(^|[^\w])@([a-zA-Z0-9](?:[a-zA-Z0-9-]*))/g, '$1(at)$2')
    .slice(0, 60);
  const title = `Memorial ${entryLabel}: ${safeTitleFragment}`;

  const issueBody = [
    `## Memorial Submission ${entryLabel}`,
    '',
    `**Who they were:** ${sanitizeMarkdown(data.humanity)}`,
    `**Relationship:** ${data.relationship}`,
    `**Age:** ${data.age ?? 'Not provided'}`,
    `**Region:** ${data.region}`,
    `**Photo:** ${data.photoUrl ? `<${data.photoUrl}>` : 'None'}`,
    '',
    '---',
    `*Entry number: ${data.entryNumber ?? 'Unassigned'}*`,
    `*Submitted: ${timestampIso}*`,
    '',
    '> To approve: add the `approved` label. To reject: close the issue.',
    '> Community reactions help prioritize.'
  ].join('\n');

  return { title, body: issueBody, labels: ['memorial-submission'] };
}

export const onRequestOptions: PagesFunction = async (context) => {
  const origin = context.request.headers.get('Origin');
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const origin = context.request.headers.get('Origin');
  const headers = corsHeaders(origin);

  let rawBody: unknown;
  try {
    rawBody = await context.request.json();
  } catch {
    return Response.json(
      { error: 'Invalid request body.' },
      { status: 400, headers }
    );
  }

  const validation = validateSubmission(rawBody);
  if (!validation.ok) {
    return Response.json({ error: validation.error }, { status: 400, headers });
  }

  const ip = context.request.headers.get('CF-Connecting-IP');
  if (isRateLimited(ip)) {
    return Response.json(
      { error: 'Too many submissions. Please try again later.' },
      { status: 429, headers }
    );
  }

  const token = context.env.GITHUB_TOKEN;
  if (!token) {
    return Response.json(
      { error: 'Submissions are not configured yet.' },
      { status: 503, headers }
    );
  }

  const payload = buildIssuePayload(validation.data, new Date().toISOString());

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'OilBurnTracker/1.0',
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('GitHub API error:', res.status, errText);
      return Response.json(
        { error: 'Failed to create submission. Please try again.' },
        { status: 502, headers }
      );
    }

    const issue = (await res.json()) as { number: number; html_url: string };
    return Response.json(
      { success: true, issueNumber: issue.number, url: issue.html_url },
      { status: 201, headers }
    );
  } catch (err) {
    console.error('Submission error:', err);
    return Response.json(
      { error: 'Internal error. Please try again.' },
      { status: 500, headers }
    );
  }
};
