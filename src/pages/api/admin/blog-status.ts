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

import {
  isWixBlogInstalled,
  WIX_BLOG_APP_ID,
  WIX_BLOG_APP_SLUG,
} from '../../../lib/server/wix-blog-installation';

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

    const installedAppIdentifiers = installedApps.filter(
      (appIdentifier): appIdentifier is string => typeof appIdentifier === 'string',
    );
    const installed = isWixBlogInstalled(installedAppIdentifiers);

    console.info('[blog-status-check] Wix Blog inventory diagnostic:', {
      siteId: appInstance.site?.siteId,
      instanceId: appInstance.instance?.instanceId,
      expectedBlogAppId: WIX_BLOG_APP_ID,
      expectedBlogAppSlug: WIX_BLOG_APP_SLUG,
      installed,
      installedWixApps: installedAppIdentifiers,
    });

    return jsonResponse({
      installed,
      checkedAt: new Date().toISOString(),
      siteId: appInstance.site?.siteId ?? null,
      instanceId: appInstance.instance?.instanceId ?? null,
      expectedBlogAppId: WIX_BLOG_APP_ID,
      expectedBlogAppSlug: WIX_BLOG_APP_SLUG,
      installedApps: installedAppIdentifiers,
    });
  } catch (error) {
    return handleApiError(error);
  }
};
