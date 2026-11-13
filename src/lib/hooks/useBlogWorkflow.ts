import { useCallback, useRef, useState } from 'react';
import { httpClient } from '@wix/essentials';
import type { GeneratedArticle } from '../blog-content';
import { createMockDraft, generateMockArticle } from '../dev/mock-blog-workflow';
import type { MediaReference, ResearchLinkInput, ResearchSource } from '../media-reference-types';

const API_BASE_URL = new URL(import.meta.url).origin;

export type BlogBriefInput = {
  topic: string;
  audience: string;
  tone: string;
  instructions: string;
  seoKeywords: string;
  researchLinks: Array<Pick<ResearchLinkInput, 'url' | 'notes'>>;
  mediaReferences: Array<Pick<MediaReference, 'name' | 'kind' | 'notes' | 'frames'>>;
};

type WorkflowNotice = {
  message: string;
  tone: 'info' | 'error' | 'success';
};

type DraftInput = { title: string; body: string };
type ApiError = { error?: string };
type WorkflowMode = 'live' | 'mock';

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

function isResearchSource(value: unknown): value is ResearchSource {
  if (!value || typeof value !== 'object') return false;
  const source = value as Record<string, unknown>;
  return (
    typeof source.id === 'string' &&
    typeof source.title === 'string' &&
    typeof source.url === 'string' &&
    typeof source.publisher === 'string' &&
    typeof source.retrievedAt === 'string' &&
    typeof source.excerpt === 'string'
  );
}

export function useBlogWorkflow({ mode = 'live' }: { mode?: WorkflowMode } = {}) {
  const [article, setArticle] = useState<GeneratedArticle | null>(null);
  const [sources, setSources] = useState<ResearchSource[]>([]);
  const [notice, setNotice] = useState<WorkflowNotice | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const submissionId = useRef<string | null>(null);

  const generateArticle = useCallback(async (brief: BlogBriefInput): Promise<void> => {
    setIsGenerating(true);
    setArticle(null);
    setSources([]);
    setDraftSaved(false);
    submissionId.current = null;
    setNotice({
      message: mode === 'mock' ? 'Generating a sample article…' : 'Preparing research and generating your article…',
      tone: 'info',
    });

    try {
      if (mode === 'mock') {
        const mockArticle = await generateMockArticle(brief);
        setArticle(mockArticle);
        setNotice({
          message: 'Mock article generated. Live research and visual analysis are disabled in mock mode.',
          tone: 'success',
        });
        return;
      }

      const result = await postWorkflowJson<{
        article?: unknown;
        sources?: unknown;
      }>('/api/workflow/generate', brief);

      if (!isGeneratedArticle(result.article)) {
        throw new Error('The generated article could not be read. Please try again.');
      }

      const verifiedSources = Array.isArray(result.sources)
        ? result.sources.filter(isResearchSource)
        : [];
      setArticle(result.article);
      setSources(verifiedSources);
      setNotice({
        message: 'Article generated with ' + verifiedSources.length + ' verified research source(s). Review the citations and edit the article before saving.',
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
  }, [mode]);

  const createDraft = useCallback(async ({ title, body }: DraftInput): Promise<void> => {
    if (!article || draftSaved) return;

    setIsSaving(true);
    setNotice({
      message: mode === 'mock' ? 'Simulating unpublished draft creation…' : 'Checking Wix Blog and saving the unpublished draft…',
      tone: 'info',
    });

    try {
      if (mode === 'mock') {
        const draft = await createMockDraft({ title, body });
        setDraftSaved(true);
        setNotice({
          message: 'Mock draft saved (' + draft.draftId + '). No Wix Blog draft was created.',
          tone: 'success',
        });
        return;
      }

      submissionId.current ??= crypto.randomUUID();
      const result = await postWorkflowJson<{
        draft?: { draftId?: unknown; status?: unknown };
      }>('/api/workflow/drafts', {
        submissionId: submissionId.current,
        title,
        body,
        metaDescription: article.metaDescription,
        seoKeywords: article.seoKeywords,
        researchSources: sources.map(({ id, title: sourceTitle, url }) => ({
          id, title: sourceTitle, url,
        })),
      });

      const draft = result.draft;
      if (!draft || typeof draft.draftId !== 'string' || draft.status !== 'UNPUBLISHED') {
        throw new Error('Wix did not confirm an unpublished draft. Check Wix Blog before retrying.');
      }

      setDraftSaved(true);
      setNotice({
        message: 'Saved as an unpublished Wix Blog draft (' + draft.draftId + '). It has not been published.',
        tone: 'success',
      });
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : 'Unable to save the draft. Check Wix Blog before retrying.',
        tone: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  }, [article, draftSaved, mode, sources]);

  return {
    article,
    sources,
    notice,
    isGenerating,
    isSaving,
    draftSaved,
    generateArticle,
    createDraft,
  };
}
