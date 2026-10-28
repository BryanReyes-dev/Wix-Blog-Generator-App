import type { APIRoute } from 'astro';
import { aiCredits } from '@wix/ai-credits';
import {
  handleApiError,
  jsonResponse,
  requireWorkflowAdministrator,
} from '../../../lib/server/access-control';

export const GET: APIRoute = async () => {
  try {
    await requireWorkflowAdministrator();

    // Preserve the Wix dashboard user's own permissions for account data.
    const balance = await aiCredits.getBalance();

    const periodicCredits = balance.periodicCredits?.balance ?? 0;
    const topUpCredits = balance.topUpCredits?.balance ?? 0;

    return jsonResponse({
      periodicCredits: {
        balance: periodicCredits,
        cap: balance.periodicCredits?.cap ?? null,
      },
      topUpCredits: {
        balance: topUpCredits,
        cap: balance.topUpCredits?.cap ?? null,
      },
      totalAvailable: periodicCredits + topUpCredits,
      // Always show the API's scope; it can be account-wide instead of site-only.
      walletScope: balance.walletScope ?? 'UNKNOWN',
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
};
