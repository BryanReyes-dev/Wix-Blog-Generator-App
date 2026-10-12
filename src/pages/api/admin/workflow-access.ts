import type { APIRoute } from 'astro';
import { items } from '@wix/data';
import { auth } from '@wix/essentials';
import {
  handleApiError,
  isWixGuid,
  jsonResponse,
  requireDashboardUser,
  WORKFLOW_ACCESS_COLLECTION_ID,
} from '../../../lib/server/access-control';

export const POST: APIRoute = async ({ request }) => {
  try {
    const administrator = await requireDashboardUser();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Send a valid JSON request body.' }, 400);
    }

    if (!body || typeof body !== 'object') {
      return jsonResponse({ error: 'A member ID and access state are required.' }, 400);
    }

    const { memberId, enabled } = body as { memberId?: unknown; enabled?: unknown };

    if (!isWixGuid(memberId) || typeof enabled !== 'boolean') {
      return jsonResponse({ error: 'A valid Wix member ID and boolean access state are required.' }, 400);
    }

    if (enabled) {
      const save = auth.elevate(items.save);
      await save(WORKFLOW_ACCESS_COLLECTION_ID, {
        _id: memberId,
        memberId,
        grantedBy: administrator.userId,
        grantedAt: new Date().toISOString(),
      });
    } else {
      const get = auth.elevate(items.get);
      const remove = auth.elevate(items.remove);
      const existing = await get(WORKFLOW_ACCESS_COLLECTION_ID, memberId, { consistentRead: true });

      // Revocation is idempotent: an already absent row is already revoked.
      if (existing) {
        await remove(WORKFLOW_ACCESS_COLLECTION_ID, memberId);
      }
    }

    return jsonResponse({ memberId, approved: enabled });
  } catch (error) {
    return handleApiError(error);
  }
};
