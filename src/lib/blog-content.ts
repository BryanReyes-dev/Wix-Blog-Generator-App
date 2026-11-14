import { ARTICLE_MEDIA_LAYOUTS, ARTICLE_SECTION_LAYOUTS, DEFAULT_ARTICLE_DESIGN, getArticleTemplate, parseArticleDesign, type ArticleDesignSettings, type ArticleSectionLayout } from "./article-layout.ts";
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
  layout: ArticleSectionLayout;
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
  sectionLayouts: ArticleSectionLayout[];
  design: ArticleDesignSettings;
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
  type: 'TEXT' | 'PARAGRAPH' | 'HEADING' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'CAPTION' | 'TABLE' | 'TABLE_ROW' | 'TABLE_CELL' | 'GALLERY' | 'BLOCKQUOTE' | 'ORDERED_LIST' | 'LIST_ITEM';
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
  tableCellData?: { cellStyle: { verticalAlignment: 'MIDDLE' }; borderColors: Record<string, never> };
  tableData?: { dimensions: { colsWidthRatio: number[]; colsMinWidth: number[]; rowsHeight: number[] } };
  blockquoteData?: { indentation: number };
  orderedListData?: { indentation: number };
  galleryData?: {
    containerData: { width: { size: 'CONTENT' }; alignment: 'CENTER'; textWrap: true };
    items: Array<{ image: { media: { src: { id: string }; width: number; height: number } } }>;
    options: { layout: { type: 'GRID'; horizontalScroll: false; orientation: 'COLUMNS'; numberOfColumns: number }; item: { ratio: number; crop: 'FILL' }; thumbnails: { placement: 'NONE' } };
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
  mediaReferences: Array<{ id: string; name: string; kind?: import('./media-reference-types').MediaKind }> = [],
  design: import('./article-layout').ArticleDesignSettings = DEFAULT_ARTICLE_DESIGN,
): GeneratedArticle {
  const input = record(value);
  if (!Array.isArray(input.sections) || input.sections.length < 2 || input.sections.length > 8) {
    throw new InputValidationError('The generated article must contain between 2 and 8 sections.');
  }

  const allowedSectionLayouts = getArticleTemplate(design.templateId).allowedSectionLayouts;
  const sections = input.sections.map((section, index) => {
    const sectionRecord = record(section);
    const requestedLayout = sectionRecord.layout;
    const layout = typeof requestedLayout === 'string' &&
      (ARTICLE_SECTION_LAYOUTS as readonly string[]).includes(requestedLayout) &&
      allowedSectionLayouts.includes(requestedLayout as ArticleSectionLayout)
      ? requestedLayout as ArticleSectionLayout
      : 'standard';
    return {
      heading: requiredText(sectionRecord.heading, `Section ${index + 1} heading`, 120),
      body: requiredText(sectionRecord.body, `Section ${index + 1} content`, 5_000),
      layout,
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

    const template = getArticleTemplate(design.templateId);
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

      const requestedLayout = placement?.layout;
      const allowedLayout = typeof requestedLayout === 'string' && (ARTICLE_MEDIA_LAYOUTS as readonly string[]).includes(requestedLayout) && template.allowedMediaLayouts.includes(requestedLayout as typeof ARTICLE_MEDIA_LAYOUTS[number])
        ? requestedLayout as typeof ARTICLE_MEDIA_LAYOUTS[number]
        : 'wide';
      const isImage = reference.kind === undefined || reference.kind === 'image';
      const layout = isImage ? allowedLayout : 'wide';
      const galleryGroup = typeof placement?.galleryGroup === 'string' && /^[a-zA-Z0-9_-]{1,32}$/.test(placement.galleryGroup.trim()) ? placement.galleryGroup.trim() : '';
      return {
        referenceId: reference.id,
        sectionIndex: typeof sectionIndex === 'number' ? sectionIndex : index % (sections.length + 1),
        afterParagraph: typeof afterParagraph === 'number' ? afterParagraph : 0,
        caption: typeof placement?.caption === 'string' ? placement.caption.trim().slice(0, 500) : reference.name,
        altText: typeof placement?.altText === 'string' ? placement.altText.trim().slice(0, 500) : reference.name,
        layout: layout === 'gallery' && !galleryGroup ? 'wide' : layout,
        galleryGroup: layout === 'gallery' ? galleryGroup : '',
        layoutText: typeof placement?.layoutText === 'string' ? placement.layoutText.trim().slice(0, 700) : '',
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

  let design: ArticleDesignSettings;
  try {
    design = parseArticleDesign(input.design);
  } catch (error) {
    throw new InputValidationError(error instanceof Error ? error.message : 'The article design settings are invalid.');
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
    const layout = typeof placement.layout === 'string' &&
      (ARTICLE_MEDIA_LAYOUTS as readonly string[]).includes(placement.layout)
      ? placement.layout as typeof ARTICLE_MEDIA_LAYOUTS[number]
      : 'wide';
    if (!getArticleTemplate(design.templateId).allowedMediaLayouts.includes(layout)) {
      throw new InputValidationError('The selected article template does not support one of the media layouts.');
    }
    return {
      referenceId,
      sectionIndex,
      afterParagraph,
      caption: typeof placement.caption === 'string' ? placement.caption.trim().slice(0, 500) : '',
      altText: typeof placement.altText === 'string' ? placement.altText.trim().slice(0, 500) : '',
      layout,
      galleryGroup: typeof placement.galleryGroup === 'string' && /^[a-zA-Z0-9_-]{1,32}$/.test(placement.galleryGroup.trim()) ? placement.galleryGroup.trim() : '',
      layoutText: typeof placement.layoutText === 'string' ? placement.layoutText.trim().slice(0, 700) : '',
    };
  });

  const rawSectionLayouts = input.sectionLayouts === undefined ? [] : input.sectionLayouts;
  if (!Array.isArray(rawSectionLayouts) || rawSectionLayouts.length > 8) {
    throw new InputValidationError('The draft section layouts are invalid.');
  }
  const allowedSectionLayouts = getArticleTemplate(design.templateId).allowedSectionLayouts;
  const sectionLayouts = rawSectionLayouts.map((layout) => {
    if (typeof layout !== 'string' || !(ARTICLE_SECTION_LAYOUTS as readonly string[]).includes(layout) ||
        !allowedSectionLayouts.includes(layout as ArticleSectionLayout)) {
      throw new InputValidationError('One of the section patterns is not available in the selected template.');
    }
    return layout as ArticleSectionLayout;
  });

  return {
    submissionId,
    title: requiredText(input.title, 'Draft title', BLOG_TITLE_MAX_LENGTH),
    body: requiredText(input.body, 'Article content', BLOG_BODY_MAX_LENGTH),
    metaDescription: requiredText(input.metaDescription, 'Meta description', BLOG_EXCERPT_MAX_LENGTH),
    seoKeywords: keywordList(input.seoKeywords, 'SEO keyword'),
    mediaPlacements,
    sectionLayouts,
    design,
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
  const containerData = { width: { size: 'CONTENT' }, alignment: 'CENTER' } as const;

  if (asset.kind === 'image') {
    const imageNode: RichTextNode = {
      type: 'IMAGE',
      nodes: caption && placement?.layout !== 'split-left' && placement?.layout !== 'split-right' ? [{ type: 'CAPTION', nodes: [textNode(caption)] }] : [],
      imageData: { containerData, image: { src: { id: asset.fileId }, width: asset.width ?? 1600, height: asset.height ?? 1000 }, altText },
    };
    if (placement?.layout === 'split-left' || placement?.layout === 'split-right') {
      const note = placement.layoutText?.trim() || caption;
      const imageCell: RichTextNode = { type: 'TABLE_CELL', tableCellData: { cellStyle: { verticalAlignment: 'MIDDLE' }, borderColors: {} }, nodes: [imageNode] };
      const textCell: RichTextNode = { type: 'TABLE_CELL', tableCellData: { cellStyle: { verticalAlignment: 'MIDDLE' }, borderColors: {} }, nodes: [headingNode('In focus', 3), paragraphNode(note)] };
      return { type: 'TABLE', nodes: [{ type: 'TABLE_ROW', nodes: placement.layout === 'split-left' ? [imageCell, textCell] : [textCell, imageCell] }], tableData: { dimensions: { colsWidthRatio: [50, 50], colsMinWidth: [120, 120], rowsHeight: [250] } } };
    }
    return imageNode;
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

function galleryRichNode(assets: WixMediaAsset[]): RichTextNode {
  const items = assets.map((asset) => ({ image: { media: { src: { id: asset.fileId }, width: asset.width ?? 1200, height: asset.height ?? 900 } } }));
  return {
    type: 'GALLERY', nodes: [],
    galleryData: {
      containerData: { width: { size: 'CONTENT' }, alignment: 'CENTER', textWrap: true },
      items,
      options: { layout: { type: 'GRID', horizontalScroll: false, orientation: 'COLUMNS', numberOfColumns: items.length >= 3 ? 3 : 2 }, item: { ratio: 1.15, crop: 'FILL' }, thumbnails: { placement: 'NONE' } },
    },
  };
}

export function bodyToRichContent(
  body: string,
  sources: Array<{ id: string; url: string }> = [],
  mediaAssets: WixMediaAsset[] = [],
  placements: MediaPlacement[] = [],
  sectionLayouts: ArticleSectionLayout[] = [],
): WixRichContent {
  const contentBlocks: RichTextNode[] = [];
  let pendingStepItems: RichTextNode[] = [];
  const flushStepList = () => {
    if (pendingStepItems.length === 0) return;
    contentBlocks.push({
      type: 'ORDERED_LIST',
      nodes: pendingStepItems,
      orderedListData: { indentation: 0 },
    });
    pendingStepItems = [];
  };
  const assetByReference = new Map(mediaAssets.map((asset) => [asset.referenceId, asset] as const));
  const placementByReference = new Map(placements.map((placement) => [placement.referenceId, placement] as const));
  const insertedReferences = new Set<string>();

  const insertAt = (sectionIndex: number, paragraphIndex: number) => {
    const matching = placements.filter((placement) => placement.sectionIndex === sectionIndex && placement.afterParagraph === paragraphIndex);
    if (matching.length > 0) flushStepList();
    for (const placement of matching) {
      if (insertedReferences.has(placement.referenceId)) continue;
      const asset = assetByReference.get(placement.referenceId);
      if (!asset) continue;
      if (placement.layout === 'gallery' && placement.galleryGroup && asset.kind === 'image') {
        const group = matching.filter((candidate) => candidate.layout === 'gallery' && candidate.galleryGroup === placement.galleryGroup && !insertedReferences.has(candidate.referenceId) && assetByReference.get(candidate.referenceId)?.kind === 'image');
        const groupAssets = group.map((candidate) => assetByReference.get(candidate.referenceId)!).filter(Boolean);
        if (groupAssets.length > 1) {
          contentBlocks.push(galleryRichNode(groupAssets));
          group.forEach((candidate) => insertedReferences.add(candidate.referenceId));
          continue;
        }
      }
      contentBlocks.push(mediaRichNode(asset, placement));
      if (asset.kind === 'video' && placement.caption.trim()) contentBlocks.push(paragraphNode(placement.caption.trim(), sources));
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
    const paragraph = paragraphNode(paragraphLines.join(' '), sources);
    const sectionLayout = currentSection >= 0 ? sectionLayouts[currentSection] ?? 'standard' : 'standard';
    if (sectionLayout === 'callout') {
      flushStepList();
      contentBlocks.push({
        type: 'BLOCKQUOTE',
        nodes: [paragraph],
        blockquoteData: { indentation: 1 },
      });
    } else if (sectionLayout === 'steps') {
      pendingStepItems.push({ type: 'LIST_ITEM', nodes: [paragraph] });
    } else {
      flushStepList();
      contentBlocks.push(paragraph);
    }
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
      flushStepList();
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
  flushStepList();

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
