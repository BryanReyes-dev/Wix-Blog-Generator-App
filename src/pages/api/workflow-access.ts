import type { APIRoute } from 'astro';
import {
  handleApiError,
  isMemberApproved,
  jsonResponse,
  requireSiteMember,
} from '../../lib/server/access-control';

export const GET: APIRoute = async () => {
  try {
    const member = await requireSiteMember();
    const authorized = await isMemberApproved(member.memberId);

    // This endpoint reveals only the caller's own approval state.
    return jsonResponse({ authorized });
  } catch (error) {
    return handleApiError(error);
  }
};
