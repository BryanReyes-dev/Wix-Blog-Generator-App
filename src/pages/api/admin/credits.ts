import type { APIRoute } from 'astro';
import { aiCredits } from '@wix/ai-credits';
import { auth } from '@wix/essentials';
import {
  handleApiError,
  jsonResponse,
  requireDashboardUser,
} from '../../../lib/server/access-control';

export const GET: APIRoute = async () => {
  try {
    await requireDashboardUser();

    const getBalance = auth.elevate(aiCredits.getBalance);
    const balance = await getBalance();

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
