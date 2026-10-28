/**
 * Wix app instance metadata may expose installed Wix apps by their short
 * identifiers (for example, "blog") rather than their catalog UUIDs.
 * Recognize both forms because the Blog API uses a catalog UUID elsewhere.
 */
export const WIX_BLOG_APP_ID = '14bcded7-0066-7c35-14d7-466cb3f09103';
export const WIX_BLOG_APP_SLUG = 'blog';

const WIX_BLOG_IDENTIFIERS = new Set([
  WIX_BLOG_APP_ID.toLowerCase(),
  WIX_BLOG_APP_SLUG,
]);

export function isWixBlogInstalled(installedWixApps: unknown): boolean {
  if (!Array.isArray(installedWixApps)) return false;

  return installedWixApps.some(
    (value) =>
      typeof value === 'string' &&
      WIX_BLOG_IDENTIFIERS.has(value.trim().toLowerCase()),
  );
}
