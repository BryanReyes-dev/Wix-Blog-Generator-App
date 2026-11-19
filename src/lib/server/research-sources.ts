import type { GeneratedArticle } from '../blog-content';

export const MAX_RESEARCH_SOURCES = 5;
export const MAX_RESEARCH_URL_LENGTH = 2_048;
export const MAX_RESEARCH_RESPONSE_BYTES = 1_048_576;
export const MAX_RESEARCH_EXCERPT_CHARS = 6_000;
const MAX_REDIRECTS = 3;

export type ResearchSource = {
  id: string;
  title: string;
  url: string;
  publisher: string;
  retrievedAt: string;
  excerpt: string;
  userNotes?: string;
};

export type ResearchLinkEntry = { id: string; url: string; notes: string };

export type ResearchLinkCheck = {
  id: string;
  url: string;
  status: 'success' | 'error';
  title?: string;
  message?: string;
};

export type ResearchSourceLoadResult = {
  sources: ResearchSource[];
  checks: ResearchLinkCheck[];
};

export type ResearchCitationSource = Pick<ResearchSource, 'id' | 'title' | 'url'>;

type ResearchSourceDiagnostics = {
  stage?: 'url_validation' | 'dns_lookup' | 'fetch' | 'http_response' | 'content_type' | 'content_extraction' | 'duplicate';
  httpStatus?: number;
  causeName?: string;
  causeCode?: string;
};

export class ResearchSourceError extends Error {
  readonly status: number;
  readonly diagnostics: ResearchSourceDiagnostics;

  constructor(message: string, status = 422, diagnostics: ResearchSourceDiagnostics = {}) {
    super(message);
    this.name = 'ResearchSourceError';
    this.status = status;
    this.diagnostics = diagnostics;
  }
}

type ResolvedAddress = { address: string; family: number };
type ResolveHost = (hostname: string) => Promise<ResolvedAddress[]>;

export type ResearchSourceLoaderConfig = {
  fetchImpl?: typeof fetch;
  resolveHost?: ResolveHost;
  timeoutMs?: number;
  maxBytes?: number;
  now?: () => Date;
};

function validateUrlSyntax(value: unknown): URL {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ResearchSourceError('Each research link must be a valid public webpage URL.', 400);
  }
  if (value.length > MAX_RESEARCH_URL_LENGTH) {
    throw new ResearchSourceError('A research URL is too long. Use URLs under 2,048 characters.', 400);
  }

  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new ResearchSourceError('A research link is not a valid URL.', 400);
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new ResearchSourceError('Research links must use HTTP or HTTPS.', 400);
  }
  if (url.username || url.password) {
    throw new ResearchSourceError('Research links must not contain a username or password.', 400);
  }
  if (url.port) {
    throw new ResearchSourceError('Research links must use the standard HTTP or HTTPS port.', 400);
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  const unwrappedHost = hostname.replace(/^\[|\]$/g, '');
  if (!hostname || unwrappedHost.includes(':') || /^(?:\d{1,3}\.){3}\d{1,3}$/.test(unwrappedHost)) {
    throw new ResearchSourceError('Use a public website hostname rather than an IP address.', 400);
  }
  if (
    !hostname.includes('.') ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.home.arpa') ||
    ['example', 'test', 'invalid', 'onion'].some((suffix) => hostname.endsWith('.' + suffix) || hostname === suffix)
  ) {
    throw new ResearchSourceError('Research links must point to a public website.', 400);
  }

  url.hostname = hostname;
  url.hash = '';
  return url;
}

function isPublicIPv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) return false;

  const [a, b, c] = parts as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 192 && b === 31 && c === 196) return false;
  if (a === 192 && b === 52 && c === 193) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function isPublicIPv6(address: string): boolean {
  const normalized = address.toLowerCase().split('%')[0] ?? '';
  if (normalized.startsWith('::ffff:') || normalized.startsWith('2001:db8:')) return false;
  const firstPart = normalized.split(':')[0] ?? '';
  const first = Number.parseInt(firstPart, 16);
  return Number.isFinite(first) && first >= 0x2000 && first <= 0x3fff;
}

function isPublicAddress(address: ResolvedAddress): boolean {
  if (address.family === 4) return isPublicIPv4(address.address);
  if (address.family === 6) return isPublicIPv6(address.address);
  return false;
}

const resolveHostname: ResolveHost = async (hostname) => {
  const recordTypes = [
    { type: 1, family: 4 },
    { type: 28, family: 6 },
  ] as const;

  const resolved = await Promise.all(recordTypes.map(async (recordType) => {
    const endpoint = new URL('https://cloudflare-dns.com/dns-query');
    endpoint.searchParams.set('name', hostname);
    endpoint.searchParams.set('type', String(recordType.type));

    const response = await fetch(endpoint, {
      headers: { Accept: 'application/dns-json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) throw new Error('Public DNS lookup failed.');

    const payload = await response.json() as {
      Status?: unknown;
      Answer?: unknown;
    };
    if (payload.Status !== 0 && payload.Status !== 3) {
      throw new Error('Public DNS lookup returned an unexpected status.');
    }
    if (!Array.isArray(payload.Answer)) return [];

    return payload.Answer.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return [];
      const answer = entry as { type?: unknown; data?: unknown };
      if (answer.type !== recordType.type || typeof answer.data !== 'string') return [];
      return [{ address: answer.data, family: recordType.family }];
    });
  }));

  return resolved.flat();
};

/**
 * Validate the URL and resolve its hostname before any outbound request.
 * Redirect targets are checked again. Deployments should also enforce outbound
 * network egress restrictions; application-level DNS checks do not eliminate
 * DNS-rebinding risk by themselves.
 */
export async function validateResearchUrl(
  value: unknown,
  resolveHost: ResolveHost = resolveHostname,
): Promise<URL> {
  const url = validateUrlSyntax(value);
  let addresses: ResolvedAddress[];
  try {
    addresses = await resolveHost(url.hostname);
  } catch (error) {
    const record = error && typeof error === 'object' ? error as Record<string, unknown> : {};
    throw new ResearchSourceError(
      'The website hostname could not be verified. This may be a temporary DNS or network issue.',
      422,
      {
        stage: 'dns_lookup',
        causeName: typeof record.name === 'string' ? record.name.slice(0, 80) : undefined,
        causeCode: typeof record.code === 'string' ? record.code.slice(0, 80) : undefined,
      },
    );
  }

  if (!Array.isArray(addresses) || addresses.length === 0 || addresses.some((address) => !isPublicAddress(address))) {
    throw new ResearchSourceError('Research links must resolve only to public internet addresses.', 400);
  }

  return url;
}

export function parseResearchCitationSources(value: unknown): ResearchCitationSource[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_RESEARCH_SOURCES) {
    throw new ResearchSourceError('Research source references must be a list of up to five sources.', 400);
  }

  const usedIds = new Set<string>();
  return value.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new ResearchSourceError('A research source reference is invalid.', 400);
    }
    const source = entry as Record<string, unknown>;
    const id = typeof source.id === 'string' ? source.id : '';
    const title = typeof source.title === 'string' ? source.title.trim() : '';
    if (!/^S[1-5]$/.test(id) || usedIds.has(id)) {
      throw new ResearchSourceError('Research source IDs must be unique IDs from S1 through S5.', 400);
    }
    if (!title || title.length > 240) {
      throw new ResearchSourceError('A research source title is missing or too long.', 400);
    }
    const url = validateUrlSyntax(source.url);
    usedIds.add(id);
    return { id, title, url: url.href };
  });
}

export function parseResearchUrls(value: unknown): string[] {
  if (value === undefined || value === null || value === '') return [];

  const entries = typeof value === 'string'
    ? value.split(/\r?\n/)
    : Array.isArray(value)
      ? value
      : null;
  if (!entries) {
    throw new ResearchSourceError('Research links must be a list of URLs.', 400);
  }

  const trimmed = entries
    .map((entry) => {
      if (typeof entry !== 'string') {
        throw new ResearchSourceError('Each research link must be a URL.', 400);
      }
      return entry.trim();
    })
    .filter(Boolean);

  if (trimmed.length > MAX_RESEARCH_SOURCES) {
    throw new ResearchSourceError('Use no more than five research links per article.', 400);
  }

  const normalized = trimmed.map((entry) => validateUrlSyntax(entry).href);
  if (new Set(normalized).size !== normalized.length) {
    throw new ResearchSourceError('Remove duplicate research links before generating the article.', 400);
  }
  return normalized;
}

export function parseResearchLinkEntries(value: unknown): ResearchLinkEntry[] {
  if (value === undefined || value === null || value === '') return [];

  const entries: unknown[] = typeof value === 'string'
    ? value.split(/\r?\n/)
    : Array.isArray(value)
      ? value
      : (() => { throw new ResearchSourceError('Research links must be a list of URLs.', 400); })();

  const usedIds = new Set<string>();
  const normalizedEntries = entries.map((entry, index): ResearchLinkEntry | null => {
    if (typeof entry === 'string') {
      const url = entry.trim();
      if (!url) return null;
      const id = 'research-link-' + (index + 1);
      usedIds.add(id);
      return { id, url, notes: '' };
    }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new ResearchSourceError(`Research link ${index + 1} is invalid.`, 400);
    }
    const record = entry as Record<string, unknown>;
    const url = typeof record.url === 'string' ? record.url.trim() : '';
    const notes = record.notes === undefined ? '' : record.notes;
    if (!url) {
      if (typeof notes === 'string' && !notes.trim()) return null;
      throw new ResearchSourceError(`Add a URL or clear the notes for research link ${index + 1}.`, 400);
    }
    if (typeof notes !== 'string' || notes.length > 500) {
      throw new ResearchSourceError(`Notes for research link ${index + 1} must be 500 characters or fewer.`, 400);
    }

    const candidateId = typeof record.id === 'string' ? record.id.trim() : '';
    const safeId = /^[A-Za-z0-9_-]{1,100}$/.test(candidateId) && !usedIds.has(candidateId)
      ? candidateId
      : 'research-link-' + (index + 1);
    usedIds.add(safeId);
    return { id: safeId, url, notes: notes.trim() };
  }).filter((entry): entry is ResearchLinkEntry => entry !== null);

  if (normalizedEntries.length > MAX_RESEARCH_SOURCES) {
    throw new ResearchSourceError('Use no more than five research links per article.', 400);
  }

  // URL syntax, DNS, redirects, and duplicate checks run per row in
  // loadResearchSourcesIndividually so a bad link never hides its siblings.
  return normalizedEntries;
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&', apos: "'", quot: '"', nbsp: ' ', lt: '<', gt: '>',
    ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”',
    ldquo: '“', hellip: '…', copy: '©', reg: '®',
  };

  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) {
      const point = Number.parseInt(code.slice(2), 16);
      return Number.isFinite(point) && point >= 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : entity;
    }
    if (code.startsWith('#')) {
      const point = Number.parseInt(code.slice(1), 10);
      return Number.isFinite(point) && point >= 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : entity;
    }
    return named[code.toLowerCase()] ?? entity;
  });
}

function fallbackTitle(url: URL): string {
  const segment = url.pathname.split('/').filter(Boolean).at(-1);
  if (!segment) return url.hostname.replace(/^www\./, '');
  try {
    return decodeURIComponent(segment.replace(/[-_]+/g, ' ')).slice(0, 240);
  } catch {
    return segment.replace(/[-_]+/g, ' ').slice(0, 240);
  }
}

export function extractResearchPage(
  html: string,
  url: URL,
  contentType = 'text/html',
): { title: string; excerpt: string } {
  let title = '';
  let text = html;

  if (contentType.toLowerCase().includes('text/plain')) {
    text = decodeHtmlEntities(html);
  } else {
    const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(html);
    if (titleMatch?.[1]) title = decodeHtmlEntities(titleMatch[1].replace(/<[^>]*>/g, ' ')).trim();

    const descriptionMatch =
      /<meta\b[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*>/i.exec(html) ??
      /<meta\b[^>]*content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']description["'][^>]*>/i.exec(html);
    const description = descriptionMatch?.[1] ? decodeHtmlEntities(descriptionMatch[1]).trim() : '';

    text = html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|button|template|iframe|canvas)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
      .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/article|\/section|\/main|\/blockquote|\/tr|\/td)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[\t\f\v ]+/g, ' ')
      .replace(/\s*\n\s*/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (description && !text.toLowerCase().includes(description.toLowerCase())) {
      text = description + '\n\n' + text;
    }
  }

  text = decodeHtmlEntities(text)
    .replace(/[\t\f\v ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (text.length < 40) {
    throw new ResearchSourceError('A research link did not contain enough readable page text to use.', 422);
  }

  return {
    title: (title || fallbackTitle(url)).slice(0, 240),
    excerpt: text.slice(0, MAX_RESEARCH_EXCERPT_CHARS),
  };
}

async function readResponseText(response: Response, maxBytes: number): Promise<string> {
  const declaredSize = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
    throw new ResearchSourceError('A research page is too large to import. Use a smaller article page.', 413);
  }
  if (!response.body) {
    throw new ResearchSourceError('A research page returned no readable content.', 422);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new ResearchSourceError('A research page is too large to import. Use a smaller article page.', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8').decode(bytes);
}

async function fetchResearchPage(
  initialUrl: URL,
  config: Required<Pick<ResearchSourceLoaderConfig, 'fetchImpl' | 'resolveHost' | 'timeoutMs' | 'maxBytes'>>,
): Promise<{ url: URL; title: string; excerpt: string }> {
  let currentUrl = initialUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    currentUrl = await validateResearchUrl(currentUrl.href, config.resolveHost);

    let response: Response;
    try {
      response = await config.fetchImpl(currentUrl.href, {
        method: 'GET',
        headers: {
          Accept: 'text/html, text/plain;q=0.9',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(config.timeoutMs),
      });
    } catch (error) {
      const record = error && typeof error === 'object' ? error as Record<string, unknown> : {};
      const errorName = typeof record.name === 'string' ? record.name : '';
      const timedOut = errorName === 'TimeoutError' || errorName === 'AbortError';
      throw new ResearchSourceError(
        timedOut
          ? 'The website did not respond within ' + Math.round(config.timeoutMs / 1000) + ' seconds. Try another page or retry later.'
          : 'The website could not be reached because the connection failed. Try another public page or retry later.',
        422,
        {
          stage: 'fetch',
          causeName: errorName.slice(0, 80) || undefined,
          causeCode: typeof record.code === 'string' ? record.code.slice(0, 80) : undefined,
        },
      );
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new ResearchSourceError('A research page returned an invalid redirect.', 422);
      if (redirectCount === MAX_REDIRECTS) {
        throw new ResearchSourceError('A research link redirected too many times.', 422);
      }

      let nextUrl: URL;
      try {
        nextUrl = new URL(location, currentUrl);
      } catch {
        throw new ResearchSourceError('A research page returned an invalid redirect URL.', 422);
      }
      currentUrl = nextUrl;
      continue;
    }

    if (!response.ok) {
      const message = response.status === 401 || response.status === 403
        ? 'The website blocked automated access (HTTP ' + response.status + '). Try another publicly accessible article page.'
        : response.status === 404
          ? 'The page was not found (HTTP 404). Check the URL or replace it with the article page.'
          : response.status === 429
            ? 'The website temporarily rate-limited the request (HTTP 429). Retry later or use another source.'
            : response.status >= 500
              ? 'The website is temporarily unavailable (HTTP ' + response.status + '). Retry later or use another source.'
              : 'The website returned HTTP ' + response.status + '. Check the URL or use another public article page.';
      throw new ResearchSourceError(message, 422, { stage: 'http_response', httpStatus: response.status });
    }

    const contentType = (response.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase();
    if (contentType !== 'text/html' && contentType !== 'text/plain') {
      throw new ResearchSourceError(
        'This URL returned ' + (contentType || 'an unknown content type') + ', not an HTML or plain-text article. Link directly to a public webpage.',
        415,
        { stage: 'content_type', httpStatus: response.status },
      );
    }

    const text = await readResponseText(response, config.maxBytes);
    const extracted = extractResearchPage(text, currentUrl, contentType);
    return { url: currentUrl, ...extracted };
  }

  throw new ResearchSourceError('A research link could not be retrieved.', 422);
}

export async function loadResearchSourcesIndividually(
  links: ResearchLinkEntry[],
  options: ResearchSourceLoaderConfig = {},
): Promise<ResearchSourceLoadResult> {
  const config = {
    fetchImpl: options.fetchImpl ?? fetch,
    resolveHost: options.resolveHost ?? resolveHostname,
    timeoutMs: options.timeoutMs ?? 10_000,
    maxBytes: options.maxBytes ?? MAX_RESEARCH_RESPONSE_BYTES,
    now: options.now ?? (() => new Date()),
  };

  if (links.length > MAX_RESEARCH_SOURCES) {
    throw new ResearchSourceError('Use no more than five research links per article.', 400);
  }

  const seenUrls = new Set<string>();
  const outcomes = await Promise.all(links.map(async (link, index) => {
    const sourceId = 'S' + (index + 1);
    const startedAt = Date.now();
    let hostname: string | null = null;
    let stage: ResearchSourceDiagnostics['stage'] = 'url_validation';

    try {
      const parsedUrl = validateUrlSyntax(link.url);
      hostname = parsedUrl.hostname;
      if (seenUrls.has(parsedUrl.href)) {
        throw new ResearchSourceError(
          'This URL duplicates an earlier research link. Use a different page or remove this row.',
          400,
          { stage: 'duplicate' },
        );
      }
      // Map callbacks run synchronously until their first await, preserving the
      // submitted order for deterministic duplicate detection and citation IDs.
      seenUrls.add(parsedUrl.href);

      stage = 'dns_lookup';
      const safeUrl = await validateResearchUrl(parsedUrl.href, config.resolveHost);
      stage = 'fetch';
      const page = await fetchResearchPage(safeUrl, config);
      const source: ResearchSource = {
        id: sourceId,
        title: page.title,
        url: page.url.href,
        publisher: page.url.hostname.replace(/^www\./, ''),
        retrievedAt: config.now().toISOString(),
        excerpt: page.excerpt,
      };
      const durationMs = Date.now() - startedAt;
      console.info('[workflow/research] link check succeeded', {
        sourceId,
        linkId: link.id,
        hostname,
        httpStatus: 200,
        durationMs,
      });
      return {
        source,
        check: { id: link.id, url: link.url, status: 'success' as const, title: page.title },
      };
    } catch (error) {
      const sourceError = error instanceof ResearchSourceError ? error : null;
      const message = sourceError?.message ?? 'The research page could not be checked because an unexpected server error occurred.';
      const diagnostics = sourceError?.diagnostics;
      console.error('[workflow/research] link check failed', {
        sourceId,
        linkId: link.id,
        hostname: hostname ?? getResearchHostname(link.url),
        stage: diagnostics?.stage ?? stage,
        httpStatus: diagnostics?.httpStatus ?? 'unknown',
        errorName: diagnostics?.causeName ?? (error instanceof Error ? error.name : 'UnknownError'),
        errorCode: diagnostics?.causeCode ?? 'unknown',
        status: sourceError?.status ?? 500,
        durationMs: Date.now() - startedAt,
        message,
      });
      return {
        source: null,
        check: { id: link.id, url: link.url, status: 'error' as const, message },
      };
    }
  }));

  return {
    sources: outcomes.flatMap((outcome) => outcome.source ? [outcome.source] : []),
    checks: outcomes.map((outcome) => outcome.check),
  };
}

function getResearchHostname(value: string): string | null {
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

export async function loadResearchSources(
  urls: string[],
  options: ResearchSourceLoaderConfig = {},
): Promise<ResearchSource[]> {
  const config = {
    fetchImpl: options.fetchImpl ?? fetch,
    resolveHost: options.resolveHost ?? resolveHostname,
    timeoutMs: options.timeoutMs ?? 10_000,
    maxBytes: options.maxBytes ?? MAX_RESEARCH_RESPONSE_BYTES,
    now: options.now ?? (() => new Date()),
  };

  if (urls.length > MAX_RESEARCH_SOURCES) {
    throw new ResearchSourceError('Use no more than five research links per article.', 400);
  }

  return await Promise.all(urls.map(async (rawUrl, index) => {
    const safeUrl = await validateResearchUrl(rawUrl, config.resolveHost);
    const page = await fetchResearchPage(safeUrl, config);
    return {
      id: 'S' + (index + 1),
      title: page.title,
      url: page.url.href,
      publisher: page.url.hostname.replace(/^www\./, ''),
      retrievedAt: config.now().toISOString(),
      excerpt: page.excerpt,
    };
  }));
}

export function assertCitationIntegrity(
  article: GeneratedArticle,
  sources: ResearchSource[],
): string[] {
  const articleText = [
    article.title,
    article.introduction,
    ...article.sections.flatMap((section) => [section.heading, section.body]),
    article.conclusion,
  ].join('\n');

  const citedIds = [...new Set(
    [...articleText.matchAll(/\[S(\d+)\]/g)].map((match) => 'S' + match[1]),
  )];
  const availableIds = new Set(sources.map((source) => source.id));
  const unknownIds = citedIds.filter((id) => !availableIds.has(id));

  if (unknownIds.length > 0) {
    throw new ResearchSourceError(
      'The generated article referenced research source(s) that were not supplied: ' + unknownIds.join(', ') + '.',
      502,
    );
  }
  if (sources.length > 0 && citedIds.length === 0) {
    throw new ResearchSourceError(
      'The generated article did not cite the supplied research. Try generating it again or adjust the brief.',
      502,
    );
  }

  return citedIds;
}
