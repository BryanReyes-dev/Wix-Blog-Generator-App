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

export type MediaPlacement = import("./media-reference-types").MediaPlacement;

export type GeneratedArticle = {
  title: string;
  introduction: string;
  sections: ArticleSection[];
  conclusion: string;
  metaDescription: string;
  seoKeywords: string[];
  mediaPlacements?: MediaPlacement[];
};

export type DraftSubmission = {
  submissionId: string;
  title: string;
  body: string;
  metaDescription: string;
  seoKeywords: string[];
  mediaPlacements: MediaPlacement[];
};

type RichTextDecoration =
  | {
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
  type: 'TEXT' | 'PARAGRAPH' | 'HEADING' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'CAPTION';
  nodes?: RichTextNode[];
  textData?: { text: string; decorations: RichTextDecoration[] };
  paragraphData?: { textStyle: { textAlignment: 'AUTO' } };
  headingData?: { level: number; textStyle: { textAlignment: 'AUTO' } };
  imageData?: {
    containerData: { width: { size: 'CONTENT' }; alignment: 'CENTER' };
    image: { src: { id: string }; width: number; height: number };
    altText: string;
  };
  videoData?: {
    containerData: { width: { size: 'CONTENT' }; alignment: 'CENTER' };
    video: { src: { id: string }; duration?: number };
    thumbnail?: { src: { id: string }; width: number; height: number };
  };
  audioData?: {
    containerData: { width: { size: 'CONTENT' }; alignment: 'CENTER' };
    audio: { src: { id: string } };
    name: string;
    disableDownload: boolean;
  };
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

export function parseGeneratedArticle(
  value: unknown,
  mediaReferences: Array<{ id: string; name: string }> = [],
): GeneratedArticle {
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

  if (mediaReferences.length > 0) {
    const supplied = Array.isArray(input.mediaPlacements) ? input.mediaPlacements : [];
    const suppliedById = new Map<string, Record<string, unknown>>();
    for (const entry of supplied) {
      const placement = record(entry);
      const id = typeof placement.referenceId === 'string' ? placement.referenceId : '';
      if (!id || suppliedById.has(id)) {
        throw new InputValidationError('The generated media placement list contains a duplicate or invalid reference ID.');
      }
      suppliedById.set(id, placement);
    }

    const allowedIds = new Set(mediaReferences.map((reference) => reference.id));
    if (Array.from(suppliedById.keys()).some((id) => !allowedIds.has(id))) {
      throw new InputValidationError('The generated article referenced media that was not attached.');
    }

    article.mediaPlacements = mediaReferences.map((reference, index) => {
      const placement = suppliedById.get(reference.id);
      const sectionIndex = placement?.sectionIndex;
      const afterParagraph = placement?.afterParagraph;
      if (sectionIndex !== undefined &&
          (typeof sectionIndex !== 'number' || !Number.isInteger(sectionIndex) || sectionIndex < -1 || sectionIndex > sections.length)) {
        throw new InputValidationError('A generated media placement has an invalid article section.');
      }
      if (afterParagraph !== undefined &&
          (typeof afterParagraph !== 'number' || !Number.isInteger(afterParagraph) || afterParagraph < 0 || afterParagraph > 20)) {
        throw new InputValidationError('A generated media placement has an invalid paragraph position.');
      }

      return {
        referenceId: reference.id,
        sectionIndex: typeof sectionIndex === 'number' ? sectionIndex : index % (sections.length + 1),
        afterParagraph: typeof afterParagraph === 'number' ? afterParagraph : 0,
        caption: typeof placement?.caption === 'string'
          ? placement.caption.trim().slice(0, 500)
          : reference.name,
        altText: typeof placement?.altText === 'string'
          ? placement.altText.trim().slice(0, 500)
          : reference.name,
      };
    });
  }

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

  const rawPlacements = input.mediaPlacements === undefined ? [] : input.mediaPlacements;
  if (!Array.isArray(rawPlacements) || rawPlacements.length > 4) {
    throw new InputValidationError('The draft media placements are invalid.');
  }
  const seenReferences = new Set<string>();
  const mediaPlacements = rawPlacements.map((entry, index): MediaPlacement => {
    const placement = record(entry);
    const referenceId = requiredText(placement.referenceId, `Media placement ${index + 1} reference ID`, 36);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(referenceId) || seenReferences.has(referenceId)) {
      throw new InputValidationError('Each media file must have one valid placement.');
    }
    seenReferences.add(referenceId);
    const sectionIndex = placement.sectionIndex;
    const afterParagraph = placement.afterParagraph;
    if (typeof sectionIndex !== 'number' || !Number.isInteger(sectionIndex) || sectionIndex < -1 || sectionIndex > 8) {
      throw new InputValidationError('A media placement has an invalid section.');
    }
    if (typeof afterParagraph !== 'number' || !Number.isInteger(afterParagraph) || afterParagraph < 0 || afterParagraph > 20) {
      throw new InputValidationError('A media placement has an invalid paragraph position.');
    }
    return {
      referenceId,
      sectionIndex,
      afterParagraph,
      caption: typeof placement.caption === 'string' ? placement.caption.trim().slice(0, 500) : '',
      altText: typeof placement.altText === 'string' ? placement.altText.trim().slice(0, 500) : '',
    };
  });

  return {
    submissionId,
    title: requiredText(input.title, 'Draft title', BLOG_TITLE_MAX_LENGTH),
    body: requiredText(input.body, 'Article content', BLOG_BODY_MAX_LENGTH),
    metaDescription: requiredText(input.metaDescription, 'Meta description', BLOG_EXCERPT_MAX_LENGTH),
    seoKeywords: keywordList(input.seoKeywords, 'SEO keyword'),
    mediaPlacements,
  };
}

function textNode(text: string, decorations: RichTextDecoration[] = []): RichTextNode {
  return {
    type: 'TEXT',
    nodes: [],
    textData: { text, decorations },
  };
}

function inlineTextNodes(text: string, sources: Array<{ id: string; url: string }>): RichTextNode[] {
  const sourceUrls = new Map(sources.map((source) => [source.id, source.url] as const));
  const nodes: RichTextNode[] = [];
  const linkDecoration = (url: string): RichTextDecoration => ({
    type: 'LINK',
    linkData: { link: { url, target: 'BLANK', rel: { noreferrer: true } } },
  });
  const pattern = /\[S\d+\]|https?:\/\/[^\s<>"']+/g;
  let cursor = 0;

  for (const match of text.matchAll(pattern)) {
    const token = match[0];
    const index = match.index;
    if (index > cursor) nodes.push(textNode(text.slice(cursor, index)));
    const citation = /^\[(S\d+)\]$/.exec(token);
    if (citation) {
      const url = sourceUrls.get(citation[1] ?? '');
      nodes.push(textNode(token, url ? [linkDecoration(url)] : []));
      cursor = index + token.length;
      continue;
    }

    const trailing = /[),.;!?]+$/.exec(token)?.[0] ?? '';
    const candidate = trailing ? token.slice(0, -trailing.length) : token;
    let safeUrl = '';
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') safeUrl = parsed.href;
    } catch {
      safeUrl = '';
    }
    nodes.push(safeUrl ? textNode(candidate, [linkDecoration(safeUrl)]) : textNode(candidate));
    if (trailing) nodes.push(textNode(trailing));
    cursor = index + token.length;
  }

  if (cursor < text.length) nodes.push(textNode(text.slice(cursor)));
  return nodes;
}

function paragraphNode(text: string, sources: Array<{ id: string; url: string }> = []): RichTextNode {
  return {
    type: 'PARAGRAPH',
    nodes: inlineTextNodes(text, sources),
    paragraphData: { textStyle: { textAlignment: 'AUTO' } },
  };
}

function headingNode(text: string, level: number, sources: Array<{ id: string; url: string }> = []): RichTextNode {
  return {
    type: 'HEADING',
    nodes: inlineTextNodes(text, sources),
    headingData: { level, textStyle: { textAlignment: 'AUTO' } },
  };
}

type WixMediaAsset = {
  referenceId: string;
  fileId: string;
  name: string;
  kind: import("./media-reference-types").MediaKind;
  fileUrl: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  videoMediaId?: string;
  videoThumbnailId?: string;
};

function mediaRichNode(
  asset: WixMediaAsset,
  placement: MediaPlacement | undefined,
): RichTextNode {
  const caption = placement?.caption?.trim() || asset.name;
  const altText = placement?.altText?.trim() || asset.name;
  const containerData = { width: { size: 'CONTENT' }, alignment: 'CENTER' };

  if (asset.kind === 'image') {
    return {
      type: 'IMAGE',
      nodes: caption ? [{ type: 'CAPTION', nodes: [textNode(caption)] }] : [],
      imageData: {
        containerData,
        image: {
          src: { id: asset.fileId },
          width: asset.width ?? 1600,
          height: asset.height ?? 1000,
        },
        altText,
      },
    };
  }

  if (asset.kind === 'video') {
    return {
      type: 'VIDEO',
      videoData: {
        containerData,
        video: {
          src: { id: asset.videoMediaId ?? `video/${asset.fileId}/1080p/mp4/file.mp4` },
          ...(asset.durationSeconds ? { duration: asset.durationSeconds } : {}),
        },
        ...(asset.videoThumbnailId ? {
          thumbnail: {
            src: { id: asset.videoThumbnailId },
            width: asset.width ?? 1280,
            height: asset.height ?? 720,
          },
        } : {}),
      },
    };
  }

  if (asset.kind === 'audio') {
    return {
      type: 'AUDIO',
      nodes: [],
      audioData: {
        containerData,
        audio: { src: { id: `mp3/${asset.fileId}` } },
        name: caption,
        disableDownload: false,
      },
    };
  }

  const decoration: RichTextDecoration = {
    type: 'LINK',
    linkData: { link: { url: asset.fileUrl, target: 'BLANK', rel: { noreferrer: true } } },
  };
  return {
    type: 'PARAGRAPH',
    nodes: [textNode('Download attachment: '), textNode(caption || asset.name, [decoration])],
    paragraphData: { textStyle: { textAlignment: 'AUTO' } },
  };
}

export function bodyToRichContent(
  body: string,
  sources: Array<{ id: string; url: string }> = [],
  mediaAssets: WixMediaAsset[] = [],
  placements: MediaPlacement[] = [],
): WixRichContent {
  const contentBlocks: RichTextNode[] = [];
  const assetByReference = new Map(mediaAssets.map((asset) => [asset.referenceId, asset] as const));
  const placementByReference = new Map(placements.map((placement) => [placement.referenceId, placement] as const));
  const insertedReferences = new Set<string>();

  const insertAt = (sectionIndex: number, paragraphIndex: number) => {
    for (const placement of placements) {
      if (placement.sectionIndex !== sectionIndex || placement.afterParagraph !== paragraphIndex) continue;
      const asset = assetByReference.get(placement.referenceId);
      if (!asset || insertedReferences.has(placement.referenceId)) continue;
      contentBlocks.push(mediaRichNode(asset, placement));
      if (asset.kind === 'video' && placement.caption.trim()) {
        contentBlocks.push(paragraphNode(placement.caption.trim(), sources));
      }
      insertedReferences.add(placement.referenceId);
    }
  };

  const lines = body.replace(/\r\n?/g, '\n').split('\n');
  const headingTitles = lines
    .map((line) => /^(#{1,6})\s+(.+)$/.exec(line.trim())?.[2]?.trim().toLowerCase() ?? '')
    .filter(Boolean);
  const sectionCount = headingTitles.filter((heading) =>
    heading !== 'introduction' && heading !== 'conclusion' && heading !== 'sources',
  ).length;

  let currentSection = -1;
  let paragraphCount = 0;
  let nextSection = 0;
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    contentBlocks.push(paragraphNode(paragraphLines.join(' '), sources));
    paragraphLines = [];
    paragraphCount += 1;
    insertAt(currentSection, paragraphCount);
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      flushParagraph();
      const hashes = headingMatch[1] ?? '';
      const heading = headingMatch[2]?.trim() ?? '';
      const normalizedHeading = heading.toLowerCase();

      if (normalizedHeading === 'introduction') {
        currentSection = -1;
      } else if (normalizedHeading === 'conclusion') {
        currentSection = sectionCount;
      } else if (normalizedHeading === 'sources') {
        currentSection = -2;
      } else {
        currentSection = nextSection;
        nextSection += 1;
      }
      paragraphCount = 0;
      contentBlocks.push(headingNode(heading, Math.max(2, hashes.length), sources));
      insertAt(currentSection, 0);
      continue;
    }

    paragraphLines.push(trimmed);
  }

  flushParagraph();

  // If a user removes or renames the target heading while editing, never silently drop an attachment.
  for (const asset of mediaAssets) {
    if (insertedReferences.has(asset.referenceId)) continue;
    const placement = placementByReference.get(asset.referenceId);
    contentBlocks.push(mediaRichNode(asset, placement));
    if (asset.kind === 'video' && placement?.caption?.trim()) {
      contentBlocks.push(paragraphNode(placement.caption.trim(), sources));
    }
    insertedReferences.add(asset.referenceId);
  }

  const nodes: RichTextNode[] = [];
  contentBlocks.forEach((block, index) => {
    if (index > 0) nodes.push({ type: 'PARAGRAPH' });
    nodes.push(block);
  });

  const richContent: WixRichContent = { nodes };
  const byteCount = new TextEncoder().encode(JSON.stringify(richContent)).byteLength;
  if (byteCount > BLOG_RICH_CONTENT_MAX_BYTES) {
    throw new InputValidationError('The article and its media blocks are too large for a Wix Blog draft.');
  }

  return richContent;
}
