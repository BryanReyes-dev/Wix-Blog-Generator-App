import { items } from '@wix/data';
import { auth } from '@wix/essentials';
import {
  ApiError,
  getActiveWixToken,
  requireApprovedMember,
  requirePrivilegedDashboardUser,
  requireWixSubject,
  type AuthenticatedIdentity,
  type AuthenticatedMember,
  type WixTokenInfo,
} from './authorization-core';

export const WORKFLOW_ACCESS_COLLECTION_ID =
  '@bg478806/blog-generator/WorkflowAccess';

async function getActiveToken() {
  return getActiveWixToken(auth.getTokenInfo as () => Promise<WixTokenInfo>);
}

/**
 * Dashboard endpoints use Wix's dashboard-user identity. They must never accept
 * a public visitor or site-member identity for elevated administration actions.
 */
export async function requireDashboardUser() {
  const token = await getActiveToken();
  return requireWixSubject(token, 'USER') satisfies AuthenticatedIdentity;
}

/**
 * Site-widget routes derive the member ID from Wix's signed token and never
 * trust a member ID supplied by the browser.
 */
export async function requireSiteMember() {
  const token = await getActiveToken();
  return requireWixSubject(token, 'MEMBER') satisfies AuthenticatedMember;
}

/**
 * Confirms a dashboard caller has Wix's privileged site access by making a
 * non-elevated read against the approval collection, whose read permission is
 * PRIVILEGED. Wix evaluates the current dashboard user's role for this call.
 */
export async function requireWorkflowAdministrator() {
  const token = await getActiveToken();

  return requirePrivilegedDashboardUser(token, async () => {
    try {
      await items.query(
        WORKFLOW_ACCESS_COLLECTION_ID,
        { paging: { limit: 1, offset: 0 } },
        { consistentRead: true },
      );

      return true;
    } catch (error) {
      const err = error && typeof error === 'object'
        ? error as Record<string, unknown>
        : {};

      const details = err.details && typeof err.details === 'object'
        ? err.details as Record<string, unknown>
        : {};

      const code = err.code ?? err.errorCode
        ?? details.code ?? details.errorCode ?? null;

      const statusCode = err.statusCode ?? err.status
        ?? details.statusCode ?? details.status ?? null;

      const message = (error instanceof Error
        ? error.message
        : String(error))
        .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
        .replace(/\s+/g, ' ')
        .slice(0, 200);

      console.error('[workflow-access-storage] Administrator query failed:', {
        errorName: error instanceof Error ? error.name : typeof error,
        code,
        statusCode,
        requestId: err.requestId ?? details.requestId ?? null,
        message,
      });

      throw new ApiError(
        503,
        \`Workflow collection check failed. Code: \${String(code ?? 'unknown')}; HTTP status: \${String(statusCode ?? 'unknown')}. Access remains blocked.\`,
      );
    }
  });
}

type AccessQueryResponse = {
  items?: unknown[];
  dataItems?: unknown[];
  _items?: unknown[];
};

/**
 * Reads whether one member has workflow access. Kept for one-member checks in
 * the protected site workflow.
 */
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

function getRecordMemberId(record: unknown): string | null {
  if (!record || typeof record !== 'object') return null;

  const item = record as Record<string, unknown>;
  const data = item.data && typeof item.data === 'object'
    ? item.data as Record<string, unknown>
    : {};
  const dataItem = item.dataItem && typeof item.dataItem === 'object'
    ? item.dataItem as Record<string, unknown>
    : {};
  const nestedData = dataItem.data && typeof dataItem.data === 'object'
    ? dataItem.data as Record<string, unknown>
    : {};

  const candidates = [
    item.memberId,
    data.memberId,
    dataItem.memberId,
    nestedData.memberId,
  ];

  return candidates.find(
    (value): value is string => typeof value === 'string',
  ) ?? null;
}

/**
 * Batch-checks the current dashboard page in one elevated Wix Data query,
 * avoiding one query per member and the Worker subrequest limit.
 */
export async function getApprovedMemberIds(
  memberIds: string[],
): Promise<Set<string>> {
  const uniqueIds = [...new Set(
    memberIds.filter((id) => typeof id === 'string' && id.length > 0),
  )];

  if (uniqueIds.length === 0) {
    return new Set<string>();
  }

  const elevatedQuery = auth.elevate(items.query);
  const result = await elevatedQuery(
    WORKFLOW_ACCESS_COLLECTION_ID,
    {
      filter: { memberId: { $in: uniqueIds } },
      paging: { limit: uniqueIds.length, offset: 0 },
    },
    { consistentRead: true },
  ) as unknown as AccessQueryResponse;

  const records = result.items ?? result.dataItems ?? result._items;

  if (!Array.isArray(records)) {
    throw new Error('Wix Data query returned an unrecognized access-record response.');
  }

  return new Set(
    records
      .map(getRecordMemberId)
      .filter((memberId): memberId is string => memberId !== null),
  );
}

/**
 * Reuse this guard at the start of every future member-facing operation that
 * creates or changes drafts. Authentication alone is not authorization.
 */
export async function requireApprovedSiteMember() {
  const token = await getActiveToken();
  return requireApprovedMember(token, isMemberApproved);
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
