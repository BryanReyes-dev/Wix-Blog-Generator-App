import type { APIRoute } from 'astro';
import { appInstances } from '@wix/app-management';
import { draftPosts } from '@wix/blog';
import { files } from '@wix/media';
import { auth } from '@wix/essentials';
import { handleApiError, jsonResponse, requireApprovedSiteMember } from '../../../lib/server/access-control';
import { ApiError } from '../../../lib/server/authorization-core';
import { bodyToRichContent, InputValidationError, parseDraftSubmission, type WixRichContent } from '../../../lib/blog-content';
import { articleDocumentToPlainText, articleDocumentToRichContent, ArticleDocumentError, parseArticleDocument, type ArticleDocument } from '../../../lib/article-document';
import { runDraftSubmission } from '../../../lib/server/draft-submissions';
import { isWixBlogInstalled } from '../../../lib/server/wix-blog-installation';
import { parseResearchCitationSources, ResearchSourceError } from '../../../lib/server/research-sources';
import { MediaReferenceError, parseDraftMediaInputs } from '../../../lib/server/media-references';

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

  const installedApps = appInstance.site?.installedWixApps;
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function imageMimeTypeFromName(name: string): string | null {
  const extension = name.split('.').pop()?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  return null;
}

async function verifyArticleMediaOwnership(document: ArticleDocument): Promise<void> {
  const images = document.blocks.filter((block) => block.type === 'image');
  if (images.length === 0) return;

  const getFileDescriptor = auth.elevate(files.getFileDescriptor);
  const seenUploadTokens = new Set<string>();

  for (const block of images) {
    const media = block.media;
    if (seenUploadTokens.has(media.uploadToken)) {
      throw new ArticleDocumentError('Each article image must come from a separate verified upload.');
    }
    seenUploadTokens.add(media.uploadToken);

    let response: unknown;
    try {
      response = await getFileDescriptor(media.id);
    } catch {
      throw new ApiError(404, 'One of the article images could not be found in Wix Media Manager.');
    }

    const outer = asRecord(response);
    const descriptor = outer && asRecord(outer.file)
      ? asRecord(outer.file)
      : outer;
    if (!descriptor) {
      throw new ApiError(400, 'Wix Media Manager returned an invalid image descriptor.');
    }

    const displayName = typeof descriptor.displayName === 'string'
      ? descriptor.displayName
      : '';
    const uploadPrefix = 'blog-editor-' + media.uploadToken + '-';
    if (!displayName.startsWith(uploadPrefix)) {
      throw new ApiError(403, 'An article image does not belong to a verified upload session for this editor.');
    }

    const id = typeof descriptor._id === 'string'
      ? descriptor._id
      : typeof descriptor.id === 'string'
        ? descriptor.id
        : '';
    const fileUrl = typeof descriptor.url === 'string' ? descriptor.url : '';
    let parsedUrl: URL | null = null;
    try {
      parsedUrl = new URL(fileUrl);
    } catch {
      parsedUrl = null;
    }

    const mimeType = imageMimeTypeFromName(displayName.slice(uploadPrefix.length));
    if (
      id !== media.id ||
      descriptor.mediaType !== 'IMAGE' ||
      descriptor.operationStatus !== 'READY' ||
      descriptor.state !== 'OK' ||
      descriptor.private !== false ||
      mimeType !== media.mimeType ||
      !parsedUrl ||
      parsedUrl.protocol !== 'https:' ||
      parsedUrl.hostname !== 'static.wixstatic.com' ||
      !parsedUrl.pathname.startsWith('/media/') ||
      parsedUrl.href !== media.url
    ) {
      throw new ApiError(422, 'Wix Media Manager could not verify one of the article images. Re-upload the image before saving.');
    }
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const member = await requireApprovedSiteMember();

    let body: unknown;
    try {
      const text = await request.text();
      if (text.length > 500_000) {
        return jsonResponse({ error: 'The article is too large for a Wix Blog draft.' }, 413);
      }
      body = JSON.parse(text) as unknown;
    } catch {
      return jsonResponse({ error: 'Send a valid JSON request body.' }, 400);
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new InputValidationError('Send a valid JSON object.');
    }
    const requestBody = body as Record<string, unknown>;
    const submission = parseDraftSubmission(body);
    const citationSources = parseResearchCitationSources(requestBody.researchSources);

    let richContent: WixRichContent;
    if (requestBody.articleDocument !== undefined) {
      if (requestBody.generatedByMemberId !== member.memberId) {
        throw new ApiError(403, 'The generated article does not belong to the currently signed-in Wix member. Generate it again before saving.');
      }

      const articleDocument = parseArticleDocument(requestBody.articleDocument);
      if (articleDocumentToPlainText(articleDocument) !== submission.body) {
        throw new InputValidationError('The article text does not match the structured editorial document. Refresh the editor and try again.');
      }

      await verifyArticleMediaOwnership(articleDocument);
      richContent = articleDocumentToRichContent(
        articleDocument,
        citationSources,
      ) as unknown as WixRichContent;
    } else {
      const mediaInputs = parseDraftMediaInputs(requestBody.mediaAssets);
      const placementIds = new Set(submission.mediaPlacements.map((placement) => placement.referenceId));
      if (
        placementIds.size !== submission.mediaPlacements.length ||
        mediaInputs.length !== submission.mediaPlacements.length ||
        mediaInputs.some((media) => !placementIds.has(media.referenceId))
      ) {
        throw new InputValidationError('Every uploaded media file must have exactly one article placement.');
      }

      const sourcesSection = citationSources.length
        ? '\n\n## Sources\n\n' + citationSources
            .map((source) => '- [' + source.id + '] ' + source.title.replace(/[\\r\\n]+/g, ' ') + ' — ' + source.url)
            .join('\n')
        : '';

      const mediaAssets = mediaInputs.length > 0
        ? await (async () => {
            const getFileDescriptor = auth.elevate(files.getFileDescriptor);
            const descriptors = await Promise.all(
              mediaInputs.map((media) => getFileDescriptor(media.fileId)),
            );
            const descriptorsById = new Map(
              descriptors.map((descriptor) => [descriptor._id, descriptor] as const),
            );

            return mediaInputs.map((media) => {
              const descriptor = descriptorsById.get(media.fileId);
              if (!descriptor || typeof descriptor.url !== 'string' || !descriptor.url.startsWith('https://')) {
                throw new ApiError(400, 'One of the uploaded media files could not be verified in Wix Media Manager.');
              }
              if (descriptor.operationStatus !== 'READY') {
                throw new ApiError(409, 'Wix is still processing ' + media.name + '. Wait a little and try creating the draft again.');
              }

              const allowedTypes: Record<string, string[]> = {
                image: ['IMAGE', 'VECTOR'],
                video: ['VIDEO'],
                audio: ['AUDIO'],
                document: ['DOCUMENT', 'ARCHIVE', 'OTHER'],
              };
              if (!(allowedTypes[media.kind] ?? []).includes(String(descriptor.mediaType))) {
                throw new ApiError(400, 'The uploaded file type for ' + media.name + ' does not match its article media type.');
              }

              const mediaDescriptor = descriptor.media && typeof descriptor.media === 'object'
                ? descriptor.media as Record<string, unknown>
                : {};
              const rawImage = mediaDescriptor.image && typeof mediaDescriptor.image === 'object'
                ? mediaDescriptor.image as Record<string, unknown>
                : {};
              const nestedImage = rawImage.image && typeof rawImage.image === 'object'
                ? rawImage.image as Record<string, unknown>
                : rawImage;
              const imageMediaUri = typeof rawImage.image === 'string' ? rawImage.image : '';
              const rawVideo = mediaDescriptor.video;
              const videoUri = typeof rawVideo === 'string'
                ? rawVideo
                : rawVideo && typeof rawVideo === 'object' && typeof (rawVideo as Record<string, unknown>).video === 'string'
                  ? String((rawVideo as Record<string, unknown>).video)
                  : '';
              const videoId = /^wix:video:\/\/v1\/([^/]+)/.exec(videoUri)?.[1];
              const posterId = /[?&#]posterUri=([^&#]+)/.exec(videoUri)?.[1];
              const uriWidth = /[?&#]originWidth=(\\d+)/.exec(imageMediaUri)?.[1];
              const uriHeight = /[?&#]originHeight=(\\d+)/.exec(imageMediaUri)?.[1];
              const descriptorWidth = typeof nestedImage.width === 'number' ? nestedImage.width : Number(uriWidth) || media.width;
              const descriptorHeight = typeof nestedImage.height === 'number' ? nestedImage.height : Number(uriHeight) || media.height;
              const nestedVideo = rawVideo && typeof rawVideo === 'object' ? rawVideo as Record<string, unknown> : {};
              const duration = typeof nestedVideo.duration === 'number' ? nestedVideo.duration : media.durationSeconds;

              return {
                ...media,
                fileUrl: descriptor.url,
                ...(typeof descriptor.thumbnailUrl === 'string' ? { thumbnailUrl: descriptor.thumbnailUrl } : {}),
                ...(media.kind === 'image' ? {
                  ...(typeof descriptorWidth === 'number' ? { width: descriptorWidth } : {}),
                  ...(typeof descriptorHeight === 'number' ? { height: descriptorHeight } : {}),
                } : {}),
                ...(media.kind === 'video' ? {
                  ...(typeof duration === 'number' && duration > 0 ? { durationSeconds: duration } : {}),
                  videoMediaId: 'video/' + (videoId ?? media.fileId) + '/1080p/mp4/file.mp4',
                  ...(posterId ? { videoThumbnailId: 'media/' + posterId } : {}),
                } : {}),
              };
            });
          })()
        : [];

      richContent = bodyToRichContent(
        submission.body + sourcesSection,
        citationSources,
        mediaAssets,
        submission.mediaPlacements,
        submission.sectionLayouts,
      );
    }

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
              ...(submission.seoSlug ? { seoSlug: submission.seoSlug } : {}),
              featured: submission.featured,
              hashtags: submission.hashtags,
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
    if (error instanceof MediaReferenceError) {
      return jsonResponse({ error: error.message }, 400);
    }
    if (error instanceof InputValidationError || error instanceof ArticleDocumentError) {
      return jsonResponse({ error: error.message }, 400);
    }
    return handleApiError(error);
  }
};
