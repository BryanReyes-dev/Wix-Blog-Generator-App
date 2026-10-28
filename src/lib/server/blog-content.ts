export const BLOG_TITLE_MAX_LENGTH = 200;
export const BLOG_EXCERPT_MAX_LENGTH = 500;
export const BLOG_BODY_MAX_LENGTH = 30_000;
export const BLOG_MAX_SEO_KEYWORDS = 5;
export const BLOG_RICH_CONTENT_MAX_BYTES = 350_000;

export class InputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InputValidationError';
  }
}

export type BlogBrief = {
  topic: string;
  audience: string;
  tone: string;
  instructions: string;
  seoKeywords: string[];
};

export type ArticleSection = {
  heading: string;
  body: string;
};

export type GeneratedArticle = {
  title: string;
  introduction: string;
  sections: ArticleSection[];
  conclusion: string;
  metaDescription: string;
  seoKeywords: string[];
};

export type DraftSubmission = {
  submissionId: string;
  title: string;
  body: string;
  metaDescription: string;
  seoKeywords: string[];
};

type RichTextDecoration = {
  type: 'LINK';
  linkData: {
    link: {
      url: string;
      target: 'BLANK';
      rel: { noreferrer: true };
    };
  };
};

type RichTextNode = {
  type: 'TEXT' | 'PARAGRAPH' | 'HEADING';
  nodes?: RichTextNode[];
  textData?: { text: string; decorations: RichTextDecoration[] };
  paragraphData?: { textStyle: { textAlignment: 'AUTO' } };
  headingData?: { level: number; textStyle: { textAlignment: 'AUTO' } };
};

export type WixRichContent = { nodes: RichTextNode[] };

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InputValidationError('Send a valid JSON object.');
  }

  return value as Record<string, unknown>;
}

function requiredText(
  value: unknown,
  label: string,
  maxLength: number,
): string {
  if (typeof value !== 'string') {
    throw new InputValidationError(`${label} is required.`);
  }

  const trimmed = value.trim();
  if (!trimmed) throw new InputValidationError(`${label} is required.`);
  if (trimmed.length > maxLength) {
    throw new InputValidationError(`${label} must be ${maxLength} characters or fewer.`);
  }

  return trimmed;
}

function keywordList(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new InputValidationError(`${label} must be a list of keywords.`);
  }

  if (value.length > BLOG_MAX_SEO_KEYWORDS) {
    throw new InputValidationError(`Use no more than ${BLOG_MAX_SEO_KEYWORDS} SEO keywords.`);
  }

  return value.map((entry, index) =>
    requiredText(entry, `${label} ${index + 1}`, 80),
  );
}

export function parseBlogBrief(value: unknown): BlogBrief {
  const input = record(value);
  const keywordText = typeof input.seoKeywords === 'string'
    ? input.seoKeywords.trim()
    : '';
  const seoKeywords = keywordText
    ? keywordList(keywordText.split(',').map((term) => term.trim()).filter(Boolean), 'SEO keyword')
    : [];

  return {
    topic: requiredText(input.topic, 'Topic or working title', 200),
    audience: requiredText(input.audience, 'Target audience', 300),
    tone: requiredText(input.tone, 'Writing tone', 120),
    instructions: requiredText(input.instructions, 'Main points or instructions', 3_000),
    seoKeywords,
  };
}

export function parseGeneratedArticle(value: unknown): GeneratedArticle {
  const input = record(value);
  if (!Array.isArray(input.sections) || input.sections.length < 2 || input.sections.length > 8) {
    throw new InputValidationError('The generated article must contain between 2 and 8 sections.');
  }

  const sections = input.sections.map((section, index) => {
    const sectionRecord = record(section);
    return {
      heading: requiredText(sectionRecord.heading, `Section ${index + 1} heading`, 120),
      body: requiredText(sectionRecord.body, `Section ${index + 1} content`, 5_000),
    };
  });

  const article: GeneratedArticle = {
    title: requiredText(input.title, 'Generated title', BLOG_TITLE_MAX_LENGTH),
    introduction: requiredText(input.introduction, 'Introduction', 5_000),
    sections,
    conclusion: requiredText(input.conclusion, 'Conclusion', 4_000),
    metaDescription: requiredText(input.metaDescription, 'Meta description', BLOG_EXCERPT_MAX_LENGTH),
    seoKeywords: keywordList(input.seoKeywords, 'SEO keyword'),
  };

  if (articleToEditableBody(article).length > BLOG_BODY_MAX_LENGTH) {
    throw new InputValidationError('The generated article is too long. Generate a shorter article.');
  }

  return article;
}

export function articleToEditableBody(article: GeneratedArticle): string {
  return [
    '## Introduction',
    article.introduction,
    ...article.sections.flatMap((section) => [`## ${section.heading}`, section.body]),
    '## Conclusion',
    article.conclusion,
  ].join('\n\n');
}

export function parseDraftSubmission(value: unknown): DraftSubmission {
  const input = record(value);
  const submissionId = requiredText(input.submissionId, 'Submission ID', 36);

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId)) {
    throw new InputValidationError('A valid submission ID is required.');
  }

  return {
    submissionId,
    title: requiredText(input.title, 'Draft title', BLOG_TITLE_MAX_LENGTH),
    body: requiredText(input.body, 'Article content', BLOG_BODY_MAX_LENGTH),
    metaDescription: requiredText(input.metaDescription, 'Meta description', BLOG_EXCERPT_MAX_LENGTH),
    seoKeywords: keywordList(input.seoKeywords, 'SEO keyword'),
  };
}

type CitationLink = { id: string; url: string };

function textNode(text: string, decorations: RichTextDecoration[] = []): RichTextNode {
  return {
    type: 'TEXT',
    nodes: [],
    textData: { text, decorations },
  };
}

function inlineTextNodes(text: string, citationSources: CitationLink[]): RichTextNode[] {
  const sourceById = new Map(citationSources.map((source) => [source.id, source.url]));
  const pattern = /\[S\d+\]|https?:\/\/[^\s<>"']+/g;
  const nodes: RichTextNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(pattern)) {
    const token = match[0];
    const index = match.index;
    if (index > cursor) nodes.push(textNode(text.slice(cursor, index)));

    const citation = /^\[(S\d+)\]$/.exec(token);
    if (citation) {
      const sourceUrl = sourceById.get(citation[1] ?? '');
      nodes.push(sourceUrl
        ? textNode(token, [{
            type: 'LINK',
            linkData: { link: { url: sourceUrl, target: 'BLANK', rel: { noreferrer: true } } },
          }])
        : textNode(token));
      cursor = index + token.length;
      continue;
    }

    const trailing = /[),.;!?]+$/.exec(token)?.[0] ?? '';
    const candidate = trailing ? token.slice(0, -trailing.length) : token;
    let safeUrl: string | null = null;
    try {
      const url = new URL(candidate);
      if (url.protocol === 'http:' || url.protocol === 'https:') safeUrl = url.href;
    } catch {
      // Invalid URL-looking text remains a plain text node.
    }

    nodes.push(safeUrl
      ? textNode(candidate, [{
          type: 'LINK',
          linkData: { link: { url: safeUrl, target: 'BLANK', rel: { noreferrer: true } } },
        }])
      : textNode(candidate));
    if (trailing) nodes.push(textNode(trailing));
    cursor = index + token.length;
  }

  if (cursor < text.length) nodes.push(textNode(text.slice(cursor)));
  return nodes.length ? nodes : [textNode(text)];
}

function paragraphNode(text: string, citationSources: CitationLink[]): RichTextNode {
  return {
    type: 'PARAGRAPH',
    nodes: inlineTextNodes(text, citationSources),
    paragraphData: { textStyle: { textAlignment: 'AUTO' } },
  };
}

function headingNode(text: string, level: number, citationSources: CitationLink[]): RichTextNode {
  return {
    type: 'HEADING',
    nodes: inlineTextNodes(text, citationSources),
    headingData: { level, textStyle: { textAlignment: 'AUTO' } },
  };
}

export function bodyToRichContent(
  body: string,
  citationSources: CitationLink[] = [],
): WixRichContent {
  const contentBlocks: RichTextNode[] = [];
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    contentBlocks.push(paragraphNode(paragraphLines.join(' '), citationSources));
    paragraphLines = [];
  };

  for (const line of body.replace(/\r\n?/g, '\n').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      flushParagraph();
      const hashes = headingMatch[1] ?? '';
      const heading = headingMatch[2]?.trim();
      if (heading) {
        contentBlocks.push(headingNode(heading, Math.max(2, hashes.length), citationSources));
      }
      continue;
    }

    paragraphLines.push(trimmed);
  }

  flushParagraph();

  const nodes: RichTextNode[] = [];
  contentBlocks.forEach((block, index) => {
    if (index > 0) nodes.push({ type: 'PARAGRAPH' });
    nodes.push(block);
  });

  const richContent: WixRichContent = { nodes };
  const byteCount = new TextEncoder().encode(JSON.stringify(richContent)).byteLength;
  if (byteCount > BLOG_RICH_CONTENT_MAX_BYTES) {
    throw new InputValidationError('The article is too large for a Wix Blog draft.');
  }

  return richContent;
}
