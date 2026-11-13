import type { GeneratedArticle } from '../blog-content';

export const MOCK_GENERATED_ARTICLE: GeneratedArticle = {
  title: 'A Practical Guide to Better Sleep',
  introduction: 'Small, repeatable habits can make it easier to wind down and build a more consistent sleep routine.',
  sections: [
    {
      heading: 'Build a steady routine',
      body: 'Choose a consistent time to begin winding down. Keep the routine simple enough to repeat on busy evenings.',
      layout: 'standard',
    },
    {
      heading: 'Make the room comfortable',
      body: 'Reduce distracting light and noise, and choose a room temperature that feels comfortable for sleeping.',
      layout: 'callout',
    },
    {
      heading: 'Keep the changes manageable',
      body: 'Start with one adjustment, observe how it feels, and build on the habits that work for you.',
      layout: 'steps',
    },
  ],
  conclusion: 'A better routine is usually built through small changes repeated consistently. Choose one habit to start with and give it time to become familiar.',
  metaDescription: 'Practical ways to build a calmer evening routine and support more consistent sleep.',
  seoKeywords: ['sleep routine', 'better sleep', 'evening habits'],
};

export type MockBrief = {
  topic: string;
  audience: string;
  tone: string;
  instructions: string;
  seoKeywords: string;
};

export async function generateMockArticle(brief: MockBrief): Promise<GeneratedArticle> {
  const topic = brief.topic.trim() || MOCK_GENERATED_ARTICLE.title;
  const keywords = brief.seoKeywords
    .split(',')
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .slice(0, 5);

  return {
    ...MOCK_GENERATED_ARTICLE,
    title: topic === MOCK_GENERATED_ARTICLE.title ? topic : topic + ': A Practical Guide',
    metaDescription: 'A practical, ' + (brief.tone.trim() || 'clear') +
      ' guide for ' + (brief.audience.trim() || 'your audience') + ' about ' + topic + '.',
    seoKeywords: keywords.length > 0 ? keywords : MOCK_GENERATED_ARTICLE.seoKeywords,
  };
}

export async function createMockDraft(input: {
  title: string;
  body: string;
}): Promise<{ draftId: string; status: 'UNPUBLISHED' }> {
  if (!input.title.trim() || !input.body.trim()) {
    throw new Error('A title and article body are required.');
  }

  return {
    draftId: 'mock-draft-preview-001',
    status: 'UNPUBLISHED',
  };
}
