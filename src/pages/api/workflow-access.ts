import type { APIRoute } from 'astro';
import { ApiError } from '../../lib/server/authorization-core';
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
    if (error instanceof ApiError) return handleApiError(error);

    const err = error && typeof error === 'object'
      ? error as Record<string, unknown>
      : {};
    const details = err.details && typeof err.details === 'object'
      ? err.details as Record<string, unknown>
      : {};
    const code = err.code ?? err.errorCode ?? details.code ?? details.errorCode ?? null;
    const statusCode = err.statusCode ?? err.status ?? details.statusCode ?? details.status ?? null;
    const requestId = err.requestId ?? details.requestId ?? null;
    const message = (error instanceof Error ? error.message : String(error))
      .replace(/Bearer\\s+\\S+/gi, 'Bearer [redacted]')
      .replace(/\\s+/g, ' ')
      .slice(0, 200);

    console.error('[workflow-access] Approval lookup failed:', {
      errorName: error instanceof Error ? error.name : typeof error,
      code,
      statusCode,
      requestId,
      message,
    });

    return jsonResponse({
      error: 'The server could not read workflow approval records. Check the local wix dev terminal for [workflow-access] diagnostics. Access remains blocked.',
    }, 503);
  }
};
