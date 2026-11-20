import type { APIRoute } from 'astro';
import {
  handleApiError,
  jsonResponse,
  requireApprovedSiteMember,
} from '../../../lib/server/access-control';
import { runResearchNetworkDiagnostics } from '../../../lib/server/research-network-diagnostics';

export const GET: APIRoute = async () => {
  try {
    await requireApprovedSiteMember();
    const diagnostics = await runResearchNetworkDiagnostics();
    return jsonResponse(diagnostics);
  } catch (error) {
    return handleApiError(error);
  }
};
