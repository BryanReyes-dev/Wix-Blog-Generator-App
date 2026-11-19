import type { APIRoute } from 'astro';
import {
  handleApiError,
  jsonResponse,
  requireApprovedSiteMember,
} from '../../../lib/server/access-control';
import { InputValidationError, parseBlogBrief, parseGeneratedArticle } from '../../../lib/blog-content';
import { AiProviderError, generateBlogArticle } from '../../../lib/server/generate-blog-article';
import {
  assertCitationIntegrity,
  loadResearchSourcesIndividually,
  parseResearchLinkEntries,
  ResearchSourceError,
  type ResearchLinkCheck,
} from '../../../lib/server/research-sources';
import { MediaReferenceError, parseMediaReferences } from '../../../lib/server/media-references';
import { parseArticleDesign } from '../../../lib/article-layout';

type ServerEnvironment = ImportMetaEnv & {
  WIX_AI_MODEL?: string;
};

export const POST: APIRoute = async ({ request }) => {
  let researchLinkResults: ResearchLinkCheck[] = [];
  try {
    const member = await requireApprovedSiteMember();

    let body: unknown;
    try {
      const text = await request.text();
      if (text.length > 5_200_000) {
        return jsonResponse({ error: 'The brief, links, and visual references are too large. Remove a file or use smaller media.' }, 413);
      }
      body = JSON.parse(text) as unknown;
    } catch {
      return jsonResponse({ error: 'Send a valid JSON request body.' }, 400);
    }

    const brief = parseBlogBrief(body);
    const input = body as Record<string, unknown>;
    const researchLinks = parseResearchLinkEntries(input.researchLinks ?? input.researchUrls);
    const mediaReferences = parseMediaReferences(input.mediaReferences);
    let design: import('../../../lib/article-layout').ArticleDesignSettings;
    try {
      design = parseArticleDesign(input.design);
    } catch (error) {
      throw new InputValidationError(error instanceof Error ? error.message : 'The article design settings are invalid.');
    }
    const researchResult = await loadResearchSourcesIndividually(researchLinks);
    researchLinkResults = researchResult.checks;
    const failedLinks = researchLinkResults.filter((result) => result.status === 'error');
    if (failedLinks.length > 0) {
      return jsonResponse({
        error: failedLinks.length + ' research link(s) could not be verified. Replace or remove the highlighted link(s), then try again.',
        researchLinkResults,
      }, 422);
    }
    const researchSources = researchResult.sources.map((source, index) => ({
      ...source,
      userNotes: researchLinks[index]?.notes || undefined,
    }));
    const environment = import.meta.env as ServerEnvironment;
    const generated = await generateBlogArticle(brief, {
      model: environment.WIX_AI_MODEL?.trim() || 'gpt-5-mini',
      researchSources,
      mediaReferences,
      design,
    });

    let article;
    try {
      article = parseGeneratedArticle(generated, mediaReferences, design);
      assertCitationIntegrity(article, researchSources);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown validation error';
      console.warn('[workflow/generate] Wix AI article failed validation:', {
        name: error instanceof Error ? error.name : typeof error,
        reason,
      });
      throw new AiProviderError(
        'Wix AI returned an article that did not meet the required format: ' + reason + ' Please regenerate.',
        502,
      );
    }

    const sources = researchSources.map(({ excerpt, ...source }) => ({
      ...source,
      excerpt: excerpt.slice(0, 280),
    }));
    return jsonResponse({ article, sources, researchLinkResults, generatedBy: { memberId: member.memberId } });
  } catch (error) {
    if (error instanceof ResearchSourceError) {
      return jsonResponse({ error: error.message }, error.status);
    }
    if (error instanceof MediaReferenceError) {
      return jsonResponse({ error: error.message }, 400);
    }
    if (error instanceof InputValidationError) {
      return jsonResponse({ error: error.message }, 400);
    }
    if (error instanceof AiProviderError) {
      return jsonResponse({
        error: error.message,
        ...(researchLinkResults.length > 0 ? { researchLinkResults } : {}),
      }, error.status);
    }
    return handleApiError(error);
  }
};
