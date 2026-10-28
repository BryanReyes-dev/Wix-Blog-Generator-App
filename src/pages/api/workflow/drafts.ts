import type { APIRoute } from 'astro';
import { appInstances } from '@wix/app-management';
import { draftPosts } from '@wix/blog';
import { auth } from '@wix/essentials';
import { handleApiError, jsonResponse, requireApprovedSiteMember } from '../../../lib/server/access-control';
import { ApiError } from '../../../lib/server/authorization-core';
import { bodyToRichContent, InputValidationError, parseDraftSubmission } from '../../../lib/server/blog-content';
import { runDraftSubmission } from '../../../lib/server/draft-submissions';
import { isWixBlogInstalled } from '../../../lib/server/wix-blog-installation';
import { parseResearchCitationSources, ResearchSourceError } from '../../../lib/server/research-sources';

async function verifyWixBlogInstalled(): Promise<void> {
  let appInstance;

  try {
    const getAppInstance = auth.elevate(
      appInstances.getAppInstance,
    );

    appInstance = await getAppInstance();
  } catch (error) {
    console.error(
      '[blog-install-check] Get App Instance failed:',
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : error,
    );

    throw new ApiError(
      503,
      'Wix Blog installation could not be verified. Check the server logs and the Manage Your App permission. No draft was attempted.',
    );
  }

  console.info(
    '[blog-install-check] App Instance:',
    appInstance,
  );

  const installedApps = appInstance.site?.installedWixApps;
  console.info(
    '[blog-install-check] installedWixApps:',
    installedApps,
  );
  if (!Array.isArray(installedApps)) {
    throw new ApiError(
      503,
      'Wix Blog installation could not be verified. Check Manage Your App permission and site setup. No draft was attempted.',
    );
  }

  if (!isWixBlogInstalled(installedApps)) {
    throw new ApiError(
      409,
      'Wix Blog is not installed on this site. Ask the site owner to install Wix Blog before creating a draft. No draft was attempted.',
    );
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const member = await requireApprovedSiteMember();

    let body: unknown;
    try {
      const text = await request.text();
      if (text.length > 48_000) {
        return jsonResponse({ error: 'The article is too large for a Wix Blog draft.' }, 413);
      }
      body = JSON.parse(text) as unknown;
    } catch {
      return jsonResponse({ error: 'Send a valid JSON request body.' }, 400);
    }

    const submission = parseDraftSubmission(body);
    const input = body as Record<string, unknown>;
    const citationSources = parseResearchCitationSources(input.researchSources);
    const richContent = bodyToRichContent(submission.body, citationSources);

    await verifyWixBlogInstalled();

    const result = await runDraftSubmission(
      member.memberId,
      submission.submissionId,
      async () => {
        const createDraftPost = auth.elevate(draftPosts.createDraftPost);
        let created;

        try {
          created = await createDraftPost(
            {
              title: submission.title,
              memberId: member.memberId,
              excerpt: submission.metaDescription,
              richContent,
              seoData: {
                settings: {
                  keywords: submission.seoKeywords.map((term, index) => ({
                    term,
                    isMain: index === 0,
                  })),
                },
                tags: [
                  {
                    type: 'meta',
                    props: {
                      name: 'description',
                      content: submission.metaDescription,
                    },
                  },
                ],
              },
            },
            { publish: false },
          );
        } catch (error) {
          const errorRecord = error && typeof error === 'object'
            ? error as Record<string, unknown>
            : null;
          const detailsRecord = errorRecord?.details && typeof errorRecord.details === 'object'
            ? errorRecord.details as Record<string, unknown>
            : null;
          const cause = errorRecord?.cause && typeof errorRecord.cause === 'object'
            ? errorRecord.cause as Record<string, unknown>
            : null;

          // Log Wix's error metadata so permission/API failures can be diagnosed.
          // Do not log the draft title, article body, or SEO content.
          console.error('[AI Blog Generator] Wix Blog draft creation failed:', {
            name: error instanceof Error ? error.name : typeof error,
            message: error instanceof Error ? error.message : String(error),
            code: errorRecord?.code ?? errorRecord?.errorCode ?? null,
            statusCode: errorRecord?.statusCode ?? errorRecord?.status ?? null,
            requestId: errorRecord?.requestId ?? detailsRecord?.requestId ?? null,
            details: errorRecord?.details ?? null,
            cause: cause
              ? {
                  name: cause.name ?? null,
                  message: cause.message ?? null,
                  code: cause.code ?? null,
                  statusCode: cause.statusCode ?? cause.status ?? null,
                }
              : errorRecord?.cause instanceof Error
                ? { name: errorRecord.cause.name, message: errorRecord.cause.message }
                : null,
          });

          throw new ApiError(
            502,
            'Wix Blog could not create the draft. Check the server log entry for the Wix error code and status. Wix Blog drafts are never published automatically.',
          );
        }

        const createdPost = created.draftPost;
        if (!createdPost?._id || createdPost.status !== 'UNPUBLISHED') {
          throw new ApiError(
            502,
            'Wix did not confirm that the result is an unpublished draft. Check Wix Blog before retrying.',
          );
        }

        return {
          draftId: createdPost._id,
          status: 'UNPUBLISHED' as const,
        };
      },
    );

    return jsonResponse({ draft: result });
  } catch (error) {
    if (error instanceof ResearchSourceError) {
      return jsonResponse({ error: error.message }, error.status);
    }
    if (error instanceof InputValidationError) {
      return jsonResponse({ error: error.message }, 400);
    }
    return handleApiError(error);
  }
};
