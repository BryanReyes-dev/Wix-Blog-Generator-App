import type { APIRoute } from 'astro';
import { items } from '@wix/data';
import {
  handleApiError,
  isMemberApproved,
  isWixGuid,
  jsonResponse,
  requireWorkflowAdministrator,
  WORKFLOW_ACCESS_COLLECTION_ID,
} from '../../../lib/server/access-control';

export const POST: APIRoute = async ({ request }) => {
  try {
    const administrator = await requireWorkflowAdministrator();

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
      await items.save(WORKFLOW_ACCESS_COLLECTION_ID, {
        _id: memberId,
        memberId,
        grantedBy: administrator.userId,
        grantedAt: new Date().toISOString(),
      });
    } else if (await isMemberApproved(memberId)) {
      await items.remove(WORKFLOW_ACCESS_COLLECTION_ID, memberId);
    }

    return jsonResponse({ memberId, approved: enabled });
  } catch (error) {
    return handleApiError(error);
  }
};
