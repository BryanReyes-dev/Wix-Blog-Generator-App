import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { GeneratedArticle } from './blog-content';

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
};

export type ResearchCitationSource = Pick<ResearchSource, 'id' | 'title' | 'url'>;

export class ResearchSourceError extends Error {
  readonly status: number;

  constructor(message: string, status = 422) {
    super(message);
    this.name = 'ResearchSourceError';
    this.status = status;
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
  if (!hostname || isIP(unwrappedHost)) {
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
  const family = address.family || isIP(address.address);
  if (family === 4) return isPublicIPv4(address.address);
  if (family === 6) return isPublicIPv6(address.address);
  return false;
}

const resolveHostname: ResolveHost = async (hostname) =>
  lookup(hostname, { all: true, verbatim: true });

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
  } catch {
    throw new ResearchSourceError('The research link host could not be verified. Check the URL and try again.', 422);
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
          'User-Agent': 'WixBlogGeneratorResearch/1.0 (+public-webpage import)',
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(config.timeoutMs),
      });
    } catch {
      throw new ResearchSourceError('A research page could not be reached. Check the link and try again.', 422);
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
      throw new ResearchSourceError('A research page could not be retrieved. Check that the URL is public and accessible.', 422);
    }

    const contentType = (response.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase();
    if (contentType !== 'text/html' && contentType !== 'text/plain') {
      throw new ResearchSourceError('Only public HTML articles and plain-text pages can be imported right now.', 415);
    }

    const text = await readResponseText(response, config.maxBytes);
    const extracted = extractResearchPage(text, currentUrl, contentType);
    return { url: currentUrl, ...extracted };
  }

  throw new ResearchSourceError('A research link could not be retrieved.', 422);
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
