import { items } from '@wix/data';
import { auth } from '@wix/essentials';

export const WORKFLOW_ACCESS_COLLECTION_ID =
  '@bg478806/blog-generator/WorkflowAccess';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type TokenInfo = Awaited<ReturnType<typeof auth.getTokenInfo>>;

async function getActiveToken(): Promise<TokenInfo> {
  let token: TokenInfo;

  try {
    token = await auth.getTokenInfo();
  } catch {
    throw new ApiError(401, 'Sign in through Wix before continuing.');
  }

  if (!token.active || !token.siteId || !token.subjectId) {
    throw new ApiError(401, 'A valid Wix session is required.');
  }

  return token;
}

/**
 * Dashboard endpoints use Wix's dashboard-user identity. They must never accept
 * a public visitor or site-member identity for elevated administration actions.
 */
export async function requireDashboardUser() {
  const token = await getActiveToken();

  if (token.subjectType !== 'USER') {
    throw new ApiError(403, 'A Wix dashboard user session is required.');
  }

  return {
    userId: token.subjectId,
    siteId: token.siteId,
    instanceId: token.instanceId ?? null,
  };
}

/**
 * Site-widget routes derive the member ID from Wix's signed token and never
 * trust a member ID supplied by the browser.
 */
export async function requireSiteMember() {
  const token = await getActiveToken();

  if (token.subjectType !== 'MEMBER') {
    throw new ApiError(403, 'Sign in as a site member to check workflow access.');
  }

  return {
    memberId: token.subjectId,
    siteId: token.siteId,
    instanceId: token.instanceId ?? null,
  };
}

type AccessQueryResponse = {
  items?: unknown[];
  dataItems?: unknown[];
  _items?: unknown[];
};

export async function isMemberApproved(memberId: string): Promise<boolean> {
  const elevatedQuery = auth.elevate(items.query);
  const result = await elevatedQuery(
    WORKFLOW_ACCESS_COLLECTION_ID,
    {
      filter: { memberId: { $eq: memberId } },
      paging: { limit: 1, offset: 0 },
    },
    { consistentRead: true },
  ) as unknown as AccessQueryResponse;

  const records = result.items ?? result.dataItems ?? result._items;

  if (!Array.isArray(records)) {
    throw new Error('Wix Data query returned an unrecognized access-record response.');
  }

  return records.length > 0;
}

/**
 * Reuse this guard at the start of every future member-facing operation that
 * creates or changes drafts. Authentication alone is not authorization.
 */
export async function requireApprovedSiteMember() {
  const member = await requireSiteMember();

  if (!(await isMemberApproved(member.memberId))) {
    throw new ApiError(403, 'This site member has not been approved for the blog workflow.');
  }

  return member;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export function handleApiError(error: unknown): Response {
  if (error instanceof ApiError) {
    return jsonResponse({ error: error.message }, error.status);
  }

  // Keep internal details in server logs instead of exposing stacks/API errors.
  console.error('[AI Blog Generator API] Request failed.', error);
  return jsonResponse(
    { error: 'The request could not be completed. Check app permissions and site setup.' },
    500,
  );
}

export function isWixGuid(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
