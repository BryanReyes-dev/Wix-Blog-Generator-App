import { parse } from 'parse5';

type HtmlNode = {
  nodeName: string;
  tagName?: string;
  value?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: HtmlNode[];
};

type TextMetrics = {
  text: string;
  linkCharacters: number;
  paragraphs: number;
  headings: number;
};

export type ParsedResearchPdf = {
  title?: string;
  pageCount: number;
  pageTexts: string[];
};

export type ResearchPdfParser = (
  bytes: Uint8Array,
  maxPages: number,
  maxCharacters: number,
) => Promise<ParsedResearchPdf>;

const DROP_TAGS = new Set([
  'script', 'style', 'noscript', 'svg', 'nav', 'footer', 'aside', 'form',
  'button', 'template', 'iframe', 'canvas', 'dialog', 'select', 'option',
]);
const DROP_HINT = /(?:^|[-_\s])(advertisement|advert|ad-slot|sponsor|social|share|related|recommended|newsletter|subscribe|subscription|cookie|breadcrumb|sidebar|navigation|navbar|menu|promo|comments?)(?:$|[-_\s])/i;
const ARTICLE_HINT = /(?:^|[-_\s])(article|post|entry|story|content|body)(?:$|[-_\s])/i;
const BLOCK_TAGS = new Set([
  'address', 'article', 'blockquote', 'dd', 'div', 'dl', 'dt', 'figcaption',
  'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'main', 'ol', 'p',
  'pre', 'section', 'table', 'tbody', 'td', 'th', 'tr', 'ul',
]);

function attribute(node: HtmlNode, name: string): string {
  return node.attrs?.find((entry) => entry.name === name)?.value ?? '';
}

function isHidden(node: HtmlNode): boolean {
  const style = attribute(node, 'style').replace(/\s+/g, '').toLowerCase();
  return node.attrs?.some((entry) => entry.name === 'hidden') === true ||
    attribute(node, 'aria-hidden').toLowerCase() === 'true' ||
    /display:none|visibility:hidden|content-visibility:hidden/.test(style);
}

function isNoiseElement(node: HtmlNode, insideArticle: boolean): boolean {
  const tag = node.tagName ?? '';
  if (DROP_TAGS.has(tag) || isHidden(node)) return true;
  if (tag === 'header' && !insideArticle) return true;
  const identifier = attribute(node, 'id') + ' ' + attribute(node, 'class');
  return DROP_HINT.test(identifier);
}

function normalizeExtractedText(value: string): string {
  return value
    .replace(/[\t\f\v ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function measureNode(node: HtmlNode): TextMetrics {
  const parts: string[] = [];
  let linkCharacters = 0;
  let paragraphs = 0;
  let headings = 0;

  const visit = (current: HtmlNode, insideLink: boolean, insideArticle: boolean) => {
    if (current.nodeName === '#text') {
      const value = current.value ?? '';
      parts.push(value);
      if (insideLink) linkCharacters += value.trim().length;
      return;
    }

    const tag = current.tagName ?? '';
    if (isNoiseElement(current, insideArticle)) return;
    if (tag === 'p') paragraphs += 1;
    if (/^h[1-6]$/.test(tag)) headings += 1;
    if (BLOCK_TAGS.has(tag)) parts.push('\n');

    const link = insideLink || tag === 'a';
    const article = insideArticle || tag === 'article';
    for (const child of current.childNodes ?? []) visit(child, link, article);

    if (BLOCK_TAGS.has(tag)) parts.push('\n');
  };

  visit(node, false, false);
  return {
    text: normalizeExtractedText(parts.join('')),
    linkCharacters,
    paragraphs,
    headings,
  };
}

function collectArticleCandidates(root: HtmlNode): HtmlNode[] {
  const candidates: HtmlNode[] = [];
  const visit = (node: HtmlNode, insideArticle: boolean) => {
    const tag = node.tagName ?? '';
    if (isNoiseElement(node, insideArticle)) return;

    const role = attribute(node, 'role').toLowerCase();
    const itemprop = attribute(node, 'itemprop').toLowerCase();
    const identifier = attribute(node, 'id') + ' ' + attribute(node, 'class');
    const semantic = tag === 'article' || tag === 'main' || role === 'main' || itemprop === 'articlebody';
    if ((semantic || ARTICLE_HINT.test(identifier)) && candidates.length < 80) {
      candidates.push(node);
    }

    const article = insideArticle || tag === 'article';
    for (const child of node.childNodes ?? []) visit(child, article);
  };
  visit(root, false);
  return candidates;
}

function findTextInTag(root: HtmlNode, tagName: string): string {
  if (root.tagName === tagName) return measureNode(root).text;
  for (const child of root.childNodes ?? []) {
    const result = findTextInTag(child, tagName);
    if (result) return result;
  }
  return '';
}

function findMetaContent(root: HtmlNode, name: string): string {
  const visit = (node: HtmlNode): string => {
    if (node.tagName === 'meta') {
      const key = attribute(node, 'name').toLowerCase() || attribute(node, 'property').toLowerCase();
      if (key === name.toLowerCase()) return attribute(node, 'content').trim();
    }
    for (const child of node.childNodes ?? []) {
      const value = visit(child);
      if (value) return value;
    }
    return '';
  };
  return visit(root);
}

function findBody(root: HtmlNode): HtmlNode | null {
  if (root.tagName === 'body') return root;
  for (const child of root.childNodes ?? []) {
    const found = findBody(child);
    if (found) return found;
  }
  return null;
}

function fallbackTitle(url: URL): string {
  const segment = url.pathname.split('/').filter(Boolean).at(-1);
  if (!segment) return url.hostname.replace(/^www\./, '');
  try {
    return decodeURIComponent(segment.replace(/[-_]+/g, ' ')).slice(0, 240);
  } catch {
    return segment.replace(/[-_]+/g, ' ').slice(0, 240);
  }
}

/**
 * Parse HTML structurally, prefer an article/main/content container, and
 * exclude common navigation, advertising, social, and related-content blocks.
 * The caller still applies the final excerpt limit before sending text to AI.
 */
export function extractResearchHtml(
  html: string,
  url: URL,
  maxCharacters = 6_000,
): { title: string; excerpt: string } {
  const document = parse(html) as unknown as HtmlNode;
  const title =
    findTextInTag(document, 'title') ||
    findMetaContent(document, 'og:title') ||
    findTextInTag(document, 'h1') ||
    fallbackTitle(url);
  const description =
    findMetaContent(document, 'description') || findMetaContent(document, 'og:description');
  const body = findBody(document) ?? document;

  const candidates = collectArticleCandidates(body);
  const ranked = candidates
    .map((candidate) => ({ metrics: measureNode(candidate) }))
    .filter(({ metrics }) => metrics.text.length >= 40)
    .sort((a, b) => {
      const score = (metrics: TextMetrics) =>
        Math.min(metrics.text.length, 30_000) +
        metrics.paragraphs * 120 +
        metrics.headings * 45 -
        metrics.linkCharacters * 1.8;
      return score(b.metrics) - score(a.metrics);
    });

  const best = ranked[0]?.metrics ?? measureNode(body);
  let excerpt = best.text;
  if (description && !excerpt.toLowerCase().includes(description.toLowerCase())) {
    excerpt = description + '\n\n' + excerpt;
  }
  if (excerpt.length < 40) {
    throw new Error('The page did not contain enough readable article text.');
  }

  return { title: title.slice(0, 240), excerpt: excerpt.slice(0, maxCharacters) };
}

/**
 * Extract text from a bounded, text-based PDF. JavaScript actions are disabled;
 * scanned PDFs are rejected instead of silently returning empty research.
 */
export const extractResearchPdf: ResearchPdfParser = async (bytes, maxPages, maxCharacters) => {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = getDocument({
    data: bytes,
    enableXfa: false,
    useSystemFonts: false,
    stopAtErrors: true,
  });

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const extract = async (): Promise<ParsedResearchPdf> => {
    const document = await loadingTask.promise;
    const metadata = await document.getMetadata().catch(() => null);
    const info = metadata?.info as { Title?: unknown } | undefined;
    const title = typeof info?.Title === 'string' ? info.Title.trim() : '';

    if (document.numPages > maxPages) {
      return { title, pageCount: document.numPages, pageTexts: [] };
    }

    const pageTexts: string[] = [];
    let remainingCharacters = maxCharacters;
    for (let pageNumber = 1; pageNumber <= document.numPages && remainingCharacters > 0; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ('str' in item && typeof item.str === 'string' ? item.str : ''))
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (pageText) {
        const boundedText = pageText.slice(0, remainingCharacters);
        pageTexts.push(boundedText);
        remainingCharacters -= boundedText.length;
      }
      page.cleanup();
    }

    return { title, pageCount: document.numPages, pageTexts };
  };

  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error('PDF extraction exceeded the 15-second limit.')), 15_000);
  });

  try {
    return await Promise.race([extract(), timeout]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    await loadingTask.destroy().catch(() => undefined);
  }
};
