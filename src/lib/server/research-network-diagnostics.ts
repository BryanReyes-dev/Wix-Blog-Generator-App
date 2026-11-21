import { resolveHostname } from './research-sources.ts';

const PROBE_HOSTNAME = 'www.wikipedia.org';
const PROBE_URL = 'https://www.wikipedia.org/';

type ResolvedAddress = { address: string; family: number };
type ResolveHost = (hostname: string) => Promise<ResolvedAddress[]>;

export type ResearchNetworkDiagnosticOptions = {
  fetchImpl?: typeof fetch;
  resolveHost?: ResolveHost;
  timeoutMs?: number;
};

type SafeNetworkError = {
  code: string;
  errorName?: string;
  errorMessage?: string;
  causeName?: string;
  causeCode?: string;
  causeMessage?: string;
};

function toErrorRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function sanitizeDiagnosticText(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  return value
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[url]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[ip]')
    .replace(/\bBearer\s+[^\s]+/gi, 'Bearer [redacted]')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 200);
}

function normalizeDiagnosticToken(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64) || 'UNKNOWN';
}

function describeNetworkError(error: unknown, prefix: 'DNS' | 'FETCH'): SafeNetworkError {
  const root = toErrorRecord(error);
  const causes: Record<string, unknown>[] = [];
  let current = toErrorRecord(root?.cause);

  for (let depth = 0; current && depth < 4; depth += 1) {
    causes.push(current);
    current = toErrorRecord(current.cause);
  }

  const codeRecord = [root, ...causes].find((record) =>
    typeof record?.code === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(record.code),
  );
  const errorName = typeof root?.name === 'string' ? root.name.slice(0, 80) : undefined;
  const causeName = typeof causes[0]?.name === 'string' ? String(causes[0].name).slice(0, 80) : undefined;
  const causeCode = typeof codeRecord?.code === 'string' ? codeRecord.code : undefined;
  const token = causeCode ?? causeName ?? errorName ?? 'UNKNOWN';

  return {
    code: prefix + '_' + normalizeDiagnosticToken(token),
    errorName,
    errorMessage: sanitizeDiagnosticText(root?.message),
    causeName,
    causeCode,
    causeMessage: causes
      .map((cause) => sanitizeDiagnosticText(cause.message))
      .find((message): message is string => Boolean(message)),
  };
}

export const RESEARCH_NETWORK_DIAGNOSTICS_BUILD = 'research-network-2026-11-21-r1';

export async function runResearchNetworkDiagnostics(
  options: ResearchNetworkDiagnosticOptions = {},
) {
  const fetchImpl = (options.fetchImpl ?? globalThis.fetch).bind(globalThis);
  const resolveHost = options.resolveHost ?? resolveHostname;
  const timeoutMs = options.timeoutMs ?? 10_000;

  const navigatorValue = Reflect.get(globalThis, 'navigator') as { userAgent?: unknown } | undefined;
  const userAgent = typeof navigatorValue?.userAgent === 'string'
    ? navigatorValue.userAgent.slice(0, 160)
    : undefined;

  const runtime = {
    globalConstructor: Object.getPrototypeOf(globalThis)?.constructor?.name ?? 'unknown',
    userAgent,
    hasFetch: typeof fetch === 'function',
    hasAbortSignalTimeout: typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function',
    hasReadableStream: typeof ReadableStream !== 'undefined',
    hasNodeProcess: Reflect.get(globalThis, 'process') !== undefined,
  };

  const dnsStartedAt = Date.now();
  let dns: {
    status: 'ok' | 'error';
    durationMs: number;
    resolvedAddressCount?: number;
    diagnostic?: SafeNetworkError;
  };
  try {
    const addresses = await resolveHost(PROBE_HOSTNAME);
    dns = addresses.length > 0
      ? { status: 'ok', durationMs: Date.now() - dnsStartedAt, resolvedAddressCount: addresses.length }
      : {
          status: 'error',
          durationMs: Date.now() - dnsStartedAt,
          diagnostic: { code: 'DNS_NO_RECORDS', errorMessage: 'The fixed diagnostic hostname returned no address records.' },
        };
  } catch (error) {
    dns = {
      status: 'error',
      durationMs: Date.now() - dnsStartedAt,
      diagnostic: describeNetworkError(error, 'DNS'),
    };
  }

  const httpsStartedAt = Date.now();
  let https: {
    status: 'reachable' | 'failed';
    durationMs: number;
    httpStatus?: number;
    contentType?: string;
    diagnostic?: SafeNetworkError;
  };
  try {
    const response = await fetchImpl(PROBE_URL, {
      method: 'GET',
      headers: {
        Accept: 'text/html, text/plain;q=0.9, application/pdf;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const result = {
      status: 'reachable' as const,
      durationMs: Date.now() - httpsStartedAt,
      httpStatus: response.status,
      contentType: response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? undefined,
    };
    try {
      await response.body?.cancel();
    } catch {
      // A response body that already closed does not change the connectivity result.
    }
    https = result;
  } catch (error) {
    https = {
      status: 'failed',
      durationMs: Date.now() - httpsStartedAt,
      diagnostic: describeNetworkError(error, 'FETCH'),
    };
  }

  return {
    diagnosticBuild: RESEARCH_NETWORK_DIAGNOSTICS_BUILD,
    checkedAt: new Date().toISOString(),
    target: PROBE_HOSTNAME,
    runtime,
    checks: { dns, https },
  };
}
