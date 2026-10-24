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
      console.error('[blog-status-check] Wix did not return installedWixApps:', {
        siteId: appInstance.site?.siteId,
        instanceId: appInstance.instance?.instanceId,
        installedWixAppsType: typeof installedApps,
      });
      throw new ApiError(
        503,
        'Wix could not verify the installed-app list for this site. Check the server logs.',
      );
    }

    const installedAppIds = installedApps.filter(
      (appId): appId is string => typeof appId === 'string',
    );
    const normalizedInstalledAppIds = installedAppIds.map((appId) => appId.trim().toLowerCase());
    const installed = normalizedInstalledAppIds.includes(WIX_BLOG_APP_ID.toLowerCase());

    console.info('[blog-status-check] Wix Blog inventory diagnostic:', {
      siteId: appInstance.site?.siteId,
      instanceId: appInstance.instance?.instanceId,
      expectedBlogAppId: WIX_BLOG_APP_ID,
      installed,
      installedWixApps: installedAppIds,
    });

    return jsonResponse({
      installed,
      checkedAt: new Date().toISOString(),
      siteId: appInstance.site?.siteId ?? null,
      instanceId: appInstance.instance?.instanceId ?? null,
      expectedBlogAppId: WIX_BLOG_APP_ID,
      installedApps: installedAppIds,
    });
  } catch (error) {
    return handleApiError(error);
  }
};
