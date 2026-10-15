import type { APIRoute } from 'astro';
import { auth } from '@wix/essentials';
import { members as wixMembers } from '@wix/members';
import {
  handleApiError,
  isMemberApproved,
  jsonResponse,
  requireDashboardUser,
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
    await requireDashboardUser();

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
      // The SDK query builder accepts fieldsets/search as options; paging is applied
      // to the builder using limit() and skip(), then retrieved with find().
      const queryMembers = auth.elevate(wixMembers.queryMembers);
      result = await queryMembers({
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
      const listMembers = auth.elevate(wixMembers.listMembers);
      result = await listMembers({
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
    const rows = await Promise.all(sourceRows.map(async (member) => {
      const memberId = member._id ?? member.id;

      if (!memberId) {
        accessStorageAvailable = false;
        return null;
      }

      let approved: boolean | null = null;
      try {
        approved = await isMemberApproved(memberId);
      } catch {
        accessStorageAvailable = false;
      }

      return {
        memberId,
        name: displayName(member, memberId),
        email: member.loginEmail ?? null,
        status: member.status ?? 'UNKNOWN',
        activityStatus: member.activityStatus ?? 'UNKNOWN',
        privacyStatus: member.privacyStatus ?? 'UNKNOWN',
        approved,
      };
    }));

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
    });
  } catch (error) {
    return handleApiError(error);
  }
};
