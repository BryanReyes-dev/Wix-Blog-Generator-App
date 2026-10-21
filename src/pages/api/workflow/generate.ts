import type { APIRoute } from 'astro';
import {
  handleApiError,
  jsonResponse,
  requireApprovedSiteMember,
} from '../../../lib/server/access-control';
import { InputValidationError, parseBlogBrief, parseGeneratedArticle } from '../../../lib/server/blog-content';
import { AiProviderError, generateBlogArticle } from '../../../lib/server/generate-blog-article';

type ServerEnvironment = ImportMetaEnv & {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
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
      apiKey: environment.OPENAI_API_KEY,
      model: environment.OPENAI_MODEL?.trim() || 'gpt-5.4-mini',
    });

    let article;
    try {
      article = parseGeneratedArticle(generated);
    } catch {
      throw new AiProviderError('The AI provider returned article data that did not pass validation. Please try again.');
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
