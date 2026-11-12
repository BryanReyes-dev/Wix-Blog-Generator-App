import { useCallback, useRef, useState } from 'react';
import { httpClient } from '@wix/essentials';
import type { GeneratedArticle } from '../blog-content';

const API_BASE_URL = new URL(import.meta.url).origin;

export type BlogBriefInput = {
  topic: string;
  audience: string;
  tone: string;
  instructions: string;
  seoKeywords: string;
};

type WorkflowNotice = {
  message: string;
  tone: 'info' | 'error' | 'success';
};

type DraftInput = {
  title: string;
  body: string;
};

type ApiError = { error?: string };

async function postWorkflowJson<T>(path: string, payload: unknown): Promise<T> {
  const response = await httpClient.fetchWithAuth(API_BASE_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = 'The request failed. Check your permissions and site setup.';
    try {
      const result = await response.json() as ApiError;
      if (typeof result.error === 'string') message = result.error;
    } catch {
      // Keep the safe fallback for non-JSON error responses.
    }

    throw new Error(message);
  }

  return await response.json() as T;
}

function isGeneratedArticle(value: unknown): value is GeneratedArticle {
  if (!value || typeof value !== 'object') return false;
  const article = value as Record<string, unknown>;
  return (
    typeof article.title === 'string' &&
    typeof article.introduction === 'string' &&
    Array.isArray(article.sections) &&
    typeof article.conclusion === 'string' &&
    typeof article.metaDescription === 'string' &&
    Array.isArray(article.seoKeywords)
  );
}

export function useBlogWorkflow() {
  const [article, setArticle] = useState<GeneratedArticle | null>(null);
  const [notice, setNotice] = useState<WorkflowNotice | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const submissionId = useRef<string | null>(null);

  const generateArticle = useCallback(async (brief: BlogBriefInput): Promise<void> => {
    setIsGenerating(true);
    setArticle(null);
    setDraftSaved(false);
    submissionId.current = null;
    setNotice({ message: 'Generating a structured article…', tone: 'info' });

    try {
      const result = await postWorkflowJson<{ article?: unknown }>(
        '/api/workflow/generate',
        brief,
      );

      if (!isGeneratedArticle(result.article)) {
        throw new Error('The generated article could not be read. Please try again.');
      }

      setArticle(result.article);
      setNotice({
        message: 'Article generated. Review and edit it before deciding whether to save a draft.',
        tone: 'success',
      });
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : 'Article generation failed. Please try again.',
        tone: 'error',
      });
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const createDraft = useCallback(async ({ title, body }: DraftInput): Promise<void> => {
    if (!article || draftSaved) return;

    setIsSaving(true);
    setNotice({ message: 'Checking Wix Blog and saving the unpublished draft…', tone: 'info' });
    submissionId.current ??= crypto.randomUUID();

    try {
      const result = await postWorkflowJson<{
        draft?: { draftId?: unknown; status?: unknown };
      }>('/api/workflow/drafts', {
        submissionId: submissionId.current,
        title,
        body,
        metaDescription: article.metaDescription,
        seoKeywords: article.seoKeywords,
      });

      const draft = result.draft;
      if (
        !draft ||
        typeof draft.draftId !== 'string' ||
        draft.status !== 'UNPUBLISHED'
      ) {
        throw new Error('Wix did not confirm an unpublished draft. Check Wix Blog before retrying.');
      }

      setDraftSaved(true);
      setNotice({
        message: 'Saved as an unpublished Wix Blog draft (' + draft.draftId + '). It has not been published.',
        tone: 'success',
      });
    } catch (error) {
      setNotice({
        message: error instanceof Error
          ? error.message
          : 'Unable to save the draft. Check Wix Blog before retrying.',
        tone: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  }, [article, draftSaved]);

  return {
    article,
    notice,
    isGenerating,
    isSaving,
    draftSaved,
    generateArticle,
    createDraft,
  };
}
