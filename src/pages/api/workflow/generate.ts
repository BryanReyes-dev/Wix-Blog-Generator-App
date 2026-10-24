import type { APIRoute } from 'astro';
import {
  handleApiError,
  jsonResponse,
  requireApprovedSiteMember,
} from '../../../lib/server/access-control';
import { InputValidationError, parseBlogBrief, parseGeneratedArticle } from '../../../lib/server/blog-content';
import { AiProviderError, generateBlogArticle } from '../../../lib/server/generate-blog-article';

type ServerEnvironment = ImportMetaEnv & {
  WIX_AI_MODEL?: string;
};

export const POST: APIRoute = async ({ request }) => {
  try {
    await requireApprovedSiteMember();

    let body: unknown;
    try {
      const text = await request.text();
      if (text.length > 16_384) {
        return jsonResponse({ error: 'The brief is too large. Shorten it and try again.' }, 413);
      }
      body = JSON.parse(text) as unknown;
    } catch {
      return jsonResponse({ error: 'Send a valid JSON request body.' }, 400);
    }

    const brief = parseBlogBrief(body);
    const environment = import.meta.env as ServerEnvironment;
    const generated = await generateBlogArticle(brief, {
      model: environment.WIX_AI_MODEL?.trim() || 'gpt-5-mini',
    });

    let article;
    try {
      article = parseGeneratedArticle(generated);
    } catch {
      throw new AiProviderError('Wix AI returned article data that did not pass validation. Please try again.');
    }

    return jsonResponse({ article });
  } catch (error) {
    if (error instanceof InputValidationError) {
      return jsonResponse({ error: error.message }, 400);
    }
    if (error instanceof AiProviderError) {
      return jsonResponse({ error: error.message }, error.status);
    }
    return handleApiError(error);
  }
};
