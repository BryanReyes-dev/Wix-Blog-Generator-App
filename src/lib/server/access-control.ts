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
 * Admin routes are called from the Wix dashboard and require a Wix USER identity.
 * Site-member and visitor tokens are deliberately not accepted for these routes.
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
 * Site-widget routes must derive the member ID from Wix's signed token, never
 * from a client-supplied ID.
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

export async function isMemberApproved(memberId: string): Promise<boolean> {
  const elevatedGet = auth.elevate(items.get);
  const record = await elevatedGet(
    WORKFLOW_ACCESS_COLLECTION_ID,
    memberId,
    { consistentRead: true },
  );

  return Boolean(record);
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
