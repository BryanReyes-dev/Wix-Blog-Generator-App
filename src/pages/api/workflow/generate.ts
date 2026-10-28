import type { APIRoute } from 'astro';
import {
  handleApiError,
  jsonResponse,
  requireApprovedSiteMember,
} from '../../../lib/server/access-control';
import { InputValidationError, parseBlogBrief, parseGeneratedArticle } from '../../../lib/server/blog-content';
import { AiProviderError, generateBlogArticle } from '../../../lib/server/generate-blog-article';
import {
  assertCitationIntegrity,
  loadResearchSources,
  parseResearchUrls,
  ResearchSourceError,
} from '../../../lib/server/research-sources';

type ServerEnvironment = ImportMetaEnv & {
  WIX_AI_MODEL?: string;
};

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireApprovedSiteMember();

    let body: unknown;
    try {
      const text = await request.text();
      if (text.length > 24_576) {
        return jsonResponse({ error: 'The brief and research links are too large. Shorten them and try again.' }, 413);
      }
      body = JSON.parse(text) as unknown;
    } catch {
      return jsonResponse({ error: 'Send a valid JSON request body.' }, 400);
    }

    const brief = parseBlogBrief(body);
    const input = body as Record<string, unknown>;
    const researchUrls = parseResearchUrls(input.researchUrls);
    const researchSources = await loadResearchSources(researchUrls);
    const environment = import.meta.env as ServerEnvironment;
    const generated = await generateBlogArticle(brief, {
      model: environment.WIX_AI_MODEL?.trim() || 'gpt-5-mini',
      researchSources,
    });

    let article;
    try {
      article = parseGeneratedArticle(generated);
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
    return jsonResponse({ article, sources });
  } catch (error) {
    if (error instanceof ResearchSourceError) {
      return jsonResponse({ error: error.message }, error.status);
    }
    if (error instanceof InputValidationError) {
      return jsonResponse({ error: error.message }, 400);
    }
    if (error instanceof AiProviderError) {
      return jsonResponse({ error: error.message }, error.status);
    }
    return handleApiError(error);
  }
};
