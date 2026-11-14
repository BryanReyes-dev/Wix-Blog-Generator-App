import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vite-plus/test';

vi.mock('@wix/essentials', () => ({
  httpClient: { fetchWithAuth: vi.fn() },
}));

import BlogBriefFormPreview from '../src/components/dev/BlogBriefFormPreview';
import ArticleReviewEditorPreview from '../src/components/dev/ArticleReviewEditorPreview';
import DevMemberAccessPreview from '../src/components/dev/DevMemberAccessPreview';
import BlogWorkflowPreview from '../src/components/dev/BlogWorkflowPreview';
import {
  createMockDraft,
  generateMockArticle,
} from '../src/lib/dev/mock-blog-workflow';

describe('development UI previews', () => {
  it('renders the standalone member access preview in its login state', () => {
    const markup = renderToStaticMarkup(createElement(DevMemberAccessPreview));
    expect(markup).toContain('Intern sign-in');
    expect(markup).toContain('Sign in with Wix (mock)');
    expect(markup).toContain('Permission denied');
  });

  it('renders the complete workflow preview without starting a Wix request', () => {
    const markup = renderToStaticMarkup(createElement(BlogWorkflowPreview));
    expect(markup).toContain('Create a Wix Blog draft');
    expect(markup).toContain('Topic or working title');
    expect(markup).toContain('Development mock mode');
  });

  it('renders the brief form as an independent editable preview', () => {
    const markup = renderToStaticMarkup(createElement(BlogBriefFormPreview));
    expect(markup).toContain('Blog brief form preview');
    expect(markup).toContain('Target audience');
    expect(markup).toContain('Generate article');
  });

  it('renders the article editor with sample content and metadata', () => {
    const markup = renderToStaticMarkup(createElement(ArticleReviewEditorPreview));
    expect(markup).toContain('Review and edit');
    expect(markup).toContain('A Practical Guide to Better Sleep');
    expect(markup).toContain('Suggested SEO keywords');
  });

  it('generates a deterministic mock article from the submitted brief', async () => {
    const article = await generateMockArticle({
      topic: 'Spring skincare routines',
      audience: 'NYC readers',
      tone: 'friendly',
      instructions: 'Keep the advice practical.',
      seoKeywords: 'spring skincare, daily routine',
    });

    expect(article.title).toBe('Spring skincare routines: A Practical Guide');
    expect(article.metaDescription).toContain('NYC readers');
    expect(article.seoKeywords).toEqual(['spring skincare', 'daily routine']);
    expect(article.sections.length).toBeGreaterThanOrEqual(2);
  });

  it('simulates an unpublished draft without using Wix', async () => {
    const draft = await createMockDraft({
      title: 'Local preview draft',
      body: '## Introduction\n\nThis is sample content.',
    });

    expect(draft).toEqual({
      draftId: 'mock-draft-preview-001',
      status: 'UNPUBLISHED',
    });
    await expect(createMockDraft({ title: ' ', body: 'content' })).rejects.toThrow('title and article body');
  });
});
