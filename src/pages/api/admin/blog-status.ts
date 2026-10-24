import type { APIRoute } from 'astro';
import { appInstances } from '@wix/app-management';
import { auth } from '@wix/essentials';
import {
  ApiError,
} from '../../../lib/server/authorization-core';
import {
  handleApiError,
  jsonResponse,
  requireWorkflowAdministrator,
} from '../../../lib/server/access-control';

const WIX_BLOG_APP_ID = '14bcded7-0066-7c35-14d7-466cb3f09103';

export const GET: APIRoute = async () => {
  try {
    await requireWorkflowAdministrator();

    const getAppInstance = auth.elevate(appInstances.getAppInstance);
    const appInstance = await getAppInstance();
    const installedApps = appInstance.site?.installedWixApps;

    if (!Array.isArray(installedApps)) {
      throw new ApiError(
        503,
        'Wix could not verify the installed-app list for this site. Check the app-instance permissions and server logs.',
      );
    }

    return jsonResponse({
      installed: installedApps.includes(WIX_BLOG_APP_ID),
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
};
