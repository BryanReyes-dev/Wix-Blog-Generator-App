import type { APIRoute } from 'astro';
import { members as wixMembers } from '@wix/members';
import {
  getApprovedMemberIds,
  handleApiError,
  jsonResponse,
  requireWorkflowAdministrator,
} from '../../../lib/server/access-control';

type WixMember = {
  _id?: string;
  id?: string;
  loginEmail?: string;
  status?: string;
  activityStatus?: string;
  privacyStatus?: string;
  profile?: {
    nickname?: string;
    title?: string;
    slug?: string;
  };
  contact?: {
    firstName?: string;
    lastName?: string;
  };
};

type MembersResult = {
  members?: WixMember[];
  _items?: WixMember[];
  metadata?: {
    total?: number;
    count?: number;
    offset?: number;
    tooManyToCount?: boolean;
  };
  _totalCount?: number;
};

type AccessStorageDiagnostic = {
  stage: 'member-id-missing' | 'approval-query';
  errorName?: string;
  code?: string | null;
  statusCode?: string | null;
  requestId?: string | null;
  message?: string;
};

function displayName(member: WixMember, memberId: string): string {
  const contactName = [member.contact?.firstName, member.contact?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  return contactName ||
    member.profile?.nickname ||
    member.profile?.title ||
    member.loginEmail ||
    memberId;
}

export const GET: APIRoute = async ({ url }) => {
  try {
    await requireWorkflowAdministrator();

    const requestedLimit = Number(url.searchParams.get('limit') ?? 20);
    const requestedOffset = Number(url.searchParams.get('offset') ?? 0);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(50, Math.max(1, Math.floor(requestedLimit)))
      : 20;
    const offset = Number.isFinite(requestedOffset)
      ? Math.min(1_000_000, Math.max(0, Math.floor(requestedOffset)))
      : 0;
    const search = (url.searchParams.get('search') ?? '').trim().slice(0, 100);

    let result: unknown;

    if (search) {
      // Keep the dashboard user's Wix role in force for this administrative
      // directory read; elevation would replace it with the app's permissions.
      result = await wixMembers.queryMembers({
        fieldsets: ['EXTENDED'],
        search: {
          expression: search,
          fields: [
            'loginEmail',
            'contact.firstName',
            'contact.lastName',
            'profile.nickname',
          ],
        },
      }).limit(limit).skip(offset).find();
    } else {
      result = await wixMembers.listMembers({
        paging: { limit, offset },
        fieldsets: ['EXTENDED'],
      });
    }

    const response = (result ?? {}) as MembersResult;
    const sourceRows = Array.isArray(response.members)
      ? response.members
      : Array.isArray(response._items)
        ? response._items
        : [];

    let accessStorageAvailable = true;
    let accessStorageDiagnostic: AccessStorageDiagnostic | null = null;

    const validMemberIds = sourceRows
      .map((member) => member._id ?? member.id)
      .filter(
        (id): id is string => typeof id === 'string' && id.length > 0,
      );

    if (validMemberIds.length !== sourceRows.length) {
      accessStorageAvailable = false;
      accessStorageDiagnostic = { stage: 'member-id-missing' };
    }

    let approvedMemberIds = new Set<string>();
    let approvalQuerySucceeded = true;

    try {
      approvedMemberIds = await getApprovedMemberIds(validMemberIds);
    } catch (error) {
      approvalQuerySucceeded = false;
      accessStorageAvailable = false;

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

      const requestId = err.requestId ?? details.requestId ?? null;

      const message = (error instanceof Error
        ? error.message
        : String(error))
        .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
        .replace(/\s+/g, ' ')
        .slice(0, 200);

      // Prefer the query failure when both problems occur so the diagnostic
      // reports why approval storage could not be read.
      accessStorageDiagnostic = {
        stage: 'approval-query',
        errorName: error instanceof Error ? error.name : typeof error,
        code: code == null ? null : String(code),
        statusCode: statusCode == null ? null : String(statusCode),
        requestId: requestId == null ? null : String(requestId).slice(0, 100),
        message,
      };

      console.error('[workflow-access-storage] Batch approval query failed:', {
        errorName: error instanceof Error ? error.name : typeof error,
        code,
        statusCode,
        requestId,
        message,
      });
    }

    const rows = sourceRows.map((member) => {
      const memberId = member._id ?? member.id;

      if (typeof memberId !== 'string' || memberId.length === 0) {
        return null;
      }

      return {
        memberId,
        name: displayName(member, memberId),
        email: member.loginEmail ?? null,
        status: member.status ?? 'UNKNOWN',
        activityStatus: member.activityStatus ?? 'UNKNOWN',
        privacyStatus: member.privacyStatus ?? 'UNKNOWN',
        approved: approvalQuerySucceeded
          ? approvedMemberIds.has(memberId)
          : null,
      };
    });

    const totalCandidate = response.metadata?.total ?? response._totalCount;
    const total = typeof totalCandidate === 'number' && Number.isFinite(totalCandidate)
      ? totalCandidate
      : null;

    return jsonResponse({
      members: rows.filter((row): row is NonNullable<typeof row> => row !== null),
      offset,
      limit,
      total,
      hasMore: total === null
        ? sourceRows.length === limit
        : offset + sourceRows.length < total,
      accessStorageAvailable,
      accessStorageDiagnostic,
    });
  } catch (error) {
    return handleApiError(error);
  }
};
