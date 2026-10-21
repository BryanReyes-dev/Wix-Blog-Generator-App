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
    await items.query(
      WORKFLOW_ACCESS_COLLECTION_ID,
      { paging: { limit: 1, offset: 0 } },
      { consistentRead: true },
    );
    return true;
  });
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
