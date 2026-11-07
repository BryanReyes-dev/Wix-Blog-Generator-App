export type TextAlignment = "LEFT" | "CENTER" | "RIGHT" | "JUSTIFY";
export type ImageAlignment = "LEFT" | "CENTER" | "RIGHT";
export type ImageWidth = "SMALL" | "CONTENT" | "ORIGINAL" | "FULL_WIDTH";

export type BlockStyle = {
  backgroundColor: string;
  paddingTop: number;
  paddingBottom: number;
  fontFamily: string;
  fontSize: number;
  color: string;
  textAlignment: TextAlignment | "INHERIT";
  lineHeight: number;
};

export type ArticleAppearance = {
  bodyFontFamily: string;
  headingFontFamily: string;
  bodyFontSize: number;
  headingFontSize: number;
  bodyColor: string;
  headingColor: string;
  canvasColor: string;
  lineHeight: number;
  textAlignment: TextAlignment;
};

export type ArticleMedia = {
  id: string;
  url: string;
  name: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  uploadToken: string;
  width: number;
  height: number;
};

export type HeadingBlock = { id: string; type: "heading"; level: 2 | 3 | 4; text: string; style: BlockStyle };
export type ParagraphBlock = { id: string; type: "paragraph"; text: string; style: BlockStyle };
export type QuoteBlock = { id: string; type: "quote"; text: string; style: BlockStyle };
export type ListBlock = { id: string; type: "list"; items: string[]; style: BlockStyle };
export type DividerBlock = { id: string; type: "divider"; style: BlockStyle };
export type ImageBlock = {
  id: string;
  type: "image";
  media: ArticleMedia;
  altText: string;
  caption: string;
  alignment: ImageAlignment;
  width: ImageWidth;
  textWrap: boolean;
  borderWidth: number;
  borderColor: string;
  borderRadius: number;
};

export type ArticleBlock = HeadingBlock | ParagraphBlock | QuoteBlock | ListBlock | DividerBlock | ImageBlock;
export type ArticleDocument = { blocks: ArticleBlock[]; appearance: ArticleAppearance };
export type CitationSource = { id: string; title: string; url: string };
export type RicosNode = {
  type: string;
  id?: string;
  nodes?: RicosNode[];
  textData?: { text: string; decorations: Array<Record<string, unknown>> };
  paragraphData?: Record<string, unknown>;
  headingData?: Record<string, unknown>;
  bulletedListData?: Record<string, unknown>;
  listItemData?: Record<string, unknown>;
  blockquoteData?: Record<string, unknown>;
  dividerData?: Record<string, unknown>;
  imageData?: Record<string, unknown>;
  style?: Record<string, unknown>;
};

export class ArticleDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArticleDocumentError";
  }
}

const FONT_FAMILIES = [
  "Arial",
  "Georgia",
  "Inter",
  "Times New Roman",
  "Trebuchet MS",
  "Verdana",
] as const;

const DEFAULT_BLOCK_STYLE: BlockStyle = {
  backgroundColor: "",
  paddingTop: 0,
  paddingBottom: 0,
  fontFamily: "",
  fontSize: 0,
  color: "",
  textAlignment: "INHERIT",
  lineHeight: 0,
};

export const DEFAULT_ARTICLE_APPEARANCE: ArticleAppearance = {
  bodyFontFamily: "Georgia",
  headingFontFamily: "Arial",
  bodyFontSize: 17,
  headingFontSize: 30,
  bodyColor: "#344054",
  headingColor: "#172033",
  canvasColor: "#ffffff",
  lineHeight: 1.75,
  textAlignment: "LEFT",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string" || value.length > maxLength) {
    throw new ArticleDocumentError(label + " is invalid or too long.");
  }
  return value;
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number, label: string): number {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new ArticleDocumentError(label + " must be between " + min + " and " + max + ".");
  }
  return parsed;
}

function colorValue(value: unknown, fallback: string, label: string): string {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    throw new ArticleDocumentError(label + " must be a six-digit hexadecimal color.");
  }
  return value.toUpperCase();
}

function alignmentValue(value: unknown, fallback: TextAlignment): TextAlignment {
  if (value === "LEFT" || value === "CENTER" || value === "RIGHT" || value === "JUSTIFY") return value;
  if (value === undefined || value === null) return fallback;
  throw new ArticleDocumentError("Text alignment is invalid.");
}

function blockAlignmentValue(value: unknown): TextAlignment | "INHERIT" {
  if (value === undefined || value === null || value === "" || value === "INHERIT") return "INHERIT";
  return alignmentValue(value, "LEFT");
}

function fontValue(value: unknown, fallback: string, label: string): string {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string" || !(FONT_FAMILIES as readonly string[]).includes(value)) {
    throw new ArticleDocumentError(label + " is not one of the supported font families.");
  }
  return value;
}

function parseAppearance(value: unknown): ArticleAppearance {
  if (value === undefined || value === null) return { ...DEFAULT_ARTICLE_APPEARANCE };
  if (!isRecord(value)) throw new ArticleDocumentError("Article appearance settings are invalid.");
  return {
    bodyFontFamily: fontValue(value.bodyFontFamily, DEFAULT_ARTICLE_APPEARANCE.bodyFontFamily, "Body font"),
    headingFontFamily: fontValue(value.headingFontFamily, DEFAULT_ARTICLE_APPEARANCE.headingFontFamily, "Heading font"),
    bodyFontSize: boundedNumber(value.bodyFontSize, DEFAULT_ARTICLE_APPEARANCE.bodyFontSize, 12, 30, "Body font size"),
    headingFontSize: boundedNumber(value.headingFontSize, DEFAULT_ARTICLE_APPEARANCE.headingFontSize, 18, 56, "Heading font size"),
    bodyColor: colorValue(value.bodyColor, DEFAULT_ARTICLE_APPEARANCE.bodyColor, "Body text color"),
    headingColor: colorValue(value.headingColor, DEFAULT_ARTICLE_APPEARANCE.headingColor, "Heading text color"),
    canvasColor: colorValue(value.canvasColor, DEFAULT_ARTICLE_APPEARANCE.canvasColor, "Preview background"),
    lineHeight: boundedNumber(value.lineHeight, DEFAULT_ARTICLE_APPEARANCE.lineHeight, 1.1, 2.4, "Line height"),
    textAlignment: alignmentValue(value.textAlignment, DEFAULT_ARTICLE_APPEARANCE.textAlignment),
  };
}

function parseBlockStyle(value: unknown): BlockStyle {
  if (value === undefined || value === null) return { ...DEFAULT_BLOCK_STYLE };
  if (!isRecord(value)) throw new ArticleDocumentError("A block's style settings are invalid.");
  return {
    backgroundColor: colorValue(value.backgroundColor, "", "Block background"),
    paddingTop: boundedNumber(value.paddingTop, 0, 0, 64, "Top padding"),
    paddingBottom: boundedNumber(value.paddingBottom, 0, 0, 64, "Bottom padding"),
    fontFamily: fontValue(value.fontFamily, "", "Block font"),
    fontSize: boundedNumber(value.fontSize, 0, 0, 56, "Block font size"),
    color: colorValue(value.color, "", "Block text color"),
    textAlignment: blockAlignmentValue(value.textAlignment),
    lineHeight: value.lineHeight === undefined || value.lineHeight === 0 ? 0 : boundedNumber(value.lineHeight, 0, 1.1, 2.4, "Block line height"),
  };
}

function safeImageUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048) {
    throw new ArticleDocumentError("The image URL is invalid.");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ArticleDocumentError("The image URL is invalid.");
  }
  if (url.protocol !== "https:" || url.hostname !== "static.wixstatic.com" || !url.pathname.startsWith("/media/")) {
    throw new ArticleDocumentError("Only images uploaded to this site's Wix Media Manager can be embedded.");
  }
  return url.href;
}

function parseMedia(value: unknown): ArticleMedia {
  if (!isRecord(value)) throw new ArticleDocumentError("Image media information is missing.");
  const mimeType = value.mimeType;
  if (mimeType !== "image/jpeg" && mimeType !== "image/png" && mimeType !== "image/webp" && mimeType !== "image/gif") {
    throw new ArticleDocumentError("Only JPEG, PNG, WebP, and GIF images can be embedded.");
  }
  const id = boundedString(value.id, "Media ID", 1000).trim();
  if (!id) throw new ArticleDocumentError("The Wix media ID is missing.");
  const uploadToken = boundedString(value.uploadToken, "Media upload token", 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uploadToken)) {
    throw new ArticleDocumentError("The image must come from a verified editor upload.");
  }
  const name = boundedString(value.name, "Image name", 255).trim() || "Article image";
  return {
    id,
    url: safeImageUrl(value.url),
    name,
    mimeType,
    uploadToken,
    width: boundedNumber(value.width, 0, 1, 20000, "Image width"),
    height: boundedNumber(value.height, 0, 1, 20000, "Image height"),
  };
}

function parseBlock(value: unknown, index: number): ArticleBlock {
  if (!isRecord(value)) throw new ArticleDocumentError("Article block " + (index + 1) + " is invalid.");
  const id = boundedString(value.id, "Block ID", 100).trim();
  if (!id) throw new ArticleDocumentError("Article block " + (index + 1) + " is missing an ID.");
  const type = value.type;
  if (type === "heading") {
    const level = value.level;
    if (level !== 2 && level !== 3 && level !== 4) throw new ArticleDocumentError("Heading level must be H2, H3, or H4.");
    return { id, type, level, text: boundedString(value.text, "Heading", 500), style: parseBlockStyle(value.style) };
  }
  if (type === "paragraph") {
    return { id, type, text: boundedString(value.text, "Paragraph", 5000), style: parseBlockStyle(value.style) };
  }
  if (type === "quote") {
    return { id, type, text: boundedString(value.text, "Quote", 3000), style: parseBlockStyle(value.style) };
  }
  if (type === "list") {
    if (!Array.isArray(value.items) || value.items.length > 100) throw new ArticleDocumentError("A list can contain up to 100 items.");
    const items = value.items.map((item) => boundedString(item, "List item", 1000));
    return { id, type, items, style: parseBlockStyle(value.style) };
  }
  if (type === "divider") {
    return { id, type, style: parseBlockStyle(value.style) };
  }
  if (type === "image") {
    const alignment = value.alignment;
    const width = value.width;
    if (alignment !== "LEFT" && alignment !== "CENTER" && alignment !== "RIGHT") {
      throw new ArticleDocumentError("Image alignment is invalid.");
    }
    if (width !== "SMALL" && width !== "CONTENT" && width !== "ORIGINAL" && width !== "FULL_WIDTH") {
      throw new ArticleDocumentError("Image width is invalid.");
    }
    const altText = boundedString(value.altText, "Image alternative text", 1000).trim();
    if (!altText) throw new ArticleDocumentError("Add alternative text to each article image before saving.");
    return {
      id,
      type,
      media: parseMedia(value.media),
      altText,
      caption: boundedString(value.caption, "Image caption", 500),
      alignment,
      width,
      textWrap: value.textWrap === true,
      borderWidth: boundedNumber(value.borderWidth, 0, 0, 12, "Image border width"),
      borderColor: colorValue(value.borderColor, "#D0D5DD", "Image border color"),
      borderRadius: boundedNumber(value.borderRadius, 0, 0, 48, "Image border radius"),
    };
  }
  throw new ArticleDocumentError("Article block " + (index + 1) + " has an unsupported type.");
}

export function parseArticleDocument(value: unknown): ArticleDocument {
  if (!isRecord(value) || !Array.isArray(value.blocks) || value.blocks.length === 0 || value.blocks.length > 100) {
    throw new ArticleDocumentError("The article document must contain between one and 100 blocks.");
  }
  const blocks = value.blocks.map(parseBlock);
  const ids = new Set<string>();
  for (const block of blocks) {
    if (ids.has(block.id)) throw new ArticleDocumentError("Article block IDs must be unique.");
    ids.add(block.id);
  }
  const document: ArticleDocument = { blocks, appearance: parseAppearance(value.appearance) };
  if (articleDocumentToPlainText(document).length > 30000) {
    throw new ArticleDocumentError("The article content is too long. Keep the text under 30,000 characters.");
  }
  return document;
}

export function articleBodyToDocument(body: string, createId: () => string): ArticleDocument {
  const blocks: ArticleBlock[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];
  let quoteLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    blocks.push({ id: createId(), type: "paragraph", text: paragraphLines.join(" "), style: { ...DEFAULT_BLOCK_STYLE } });
    paragraphLines = [];
  };
  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push({ id: createId(), type: "list", items: [...listItems], style: { ...DEFAULT_BLOCK_STYLE } });
    listItems = [];
  };
  const flushQuote = () => {
    if (quoteLines.length === 0) return;
    blocks.push({ id: createId(), type: "quote", text: quoteLines.join(" "), style: { ...DEFAULT_BLOCK_STYLE } });
    quoteLines = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const line of body.replace(/\r\n?/g, "\n").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushAll();
      continue;
    }
    if (/^[-*_]{3,}$/.test(trimmed)) {
      flushAll();
      blocks.push({ id: createId(), type: "divider", style: { ...DEFAULT_BLOCK_STYLE } });
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushAll();
      const level = Math.min(4, Math.max(2, (heading[1] ?? "").length)) as 2 | 3 | 4;
      blocks.push({ id: createId(), type: "heading", level, text: heading[2] ?? "", style: { ...DEFAULT_BLOCK_STYLE } });
      continue;
    }
    const list = /^[-*]\s+(.+)$/.exec(trimmed);
    if (list) {
      flushParagraph();
      flushQuote();
      listItems.push(list[1] ?? "");
      continue;
    }
    const quote = /^>\s?(.+)$/.exec(trimmed);
    if (quote) {
      flushParagraph();
      flushList();
      quoteLines.push(quote[1] ?? "");
      continue;
    }
    flushList();
    flushQuote();
    paragraphLines.push(trimmed);
  }
  flushAll();

  if (blocks.length === 0) {
    blocks.push({ id: createId(), type: "paragraph", text: "", style: { ...DEFAULT_BLOCK_STYLE } });
  }
  return { blocks, appearance: { ...DEFAULT_ARTICLE_APPEARANCE } };
}

export function articleDocumentToPlainText(document: ArticleDocument): string {
  return document.blocks.map((block) => {
    switch (block.type) {
      case "heading":
        return "#".repeat(block.level) + " " + block.text;
      case "paragraph":
        return block.text;
      case "quote":
        return block.text.split("\n").map((line) => "> " + line).join("\n");
      case "list":
        return block.items.map((item) => "- " + item).join("\n");
      case "divider":
        return "---";
      case "image":
        return "[Image: " + block.altText + "]" + (block.caption ? " " + block.caption : "");
    }
  }).join("\n\n");
}

function nodeStyle(style: BlockStyle): Record<string, unknown> | undefined {
  const result: Record<string, unknown> = {};
  if (style.backgroundColor) result.backgroundColor = style.backgroundColor;
  if (style.paddingTop > 0) result.paddingTop = String(style.paddingTop) + "px";
  if (style.paddingBottom > 0) result.paddingBottom = String(style.paddingBottom) + "px";
  return Object.keys(result).length ? result : undefined;
}

function textDecorations(text: string, fontFamily: string, fontSize: number, color: string, sources: CitationSource[]): RicosNode[] {
  const sourceMap = new Map(sources.map((source) => [source.id, source.url] as const));
  const pattern = /\[(S\d+)\]|https?:\/\/[^\s<>"']+|\*\*[^*\n]+\*\*|\*[^*\n]+\*/g;
  const nodes: RicosNode[] = [];
  let cursor = 0;

  const pushText = (value: string, decorations: Array<Record<string, unknown>> = []) => {
    if (!value) return;
    const baseDecorations: Array<Record<string, unknown>> = [
      ...decorations,
      { type: "FONT_FAMILY", fontFamilyData: { value: fontFamily } },
      { type: "FONT_SIZE", fontSizeData: { unit: "PX", value: fontSize } },
      { type: "COLOR", colorData: { foreground: color } },
    ];
    nodes.push({ type: "TEXT", nodes: [], textData: { text: value, decorations: baseDecorations } });
  };

  for (const match of text.matchAll(pattern)) {
    const token = match[0];
    const index = match.index;
    if (index > cursor) pushText(text.slice(cursor, index));
    const citation = /^\[(S\d+)\]$/.exec(token);
    if (citation) {
      const url = sourceMap.get(citation[1] ?? "");
      pushText(token, url ? [{ type: "LINK", linkData: { link: { url, target: "BLANK", rel: { noreferrer: true } } } }] : []);
      cursor = index + token.length;
      continue;
    }
    if (token.startsWith("**")) {
      pushText(token.slice(2, -2), [{ type: "BOLD" }]);
      cursor = index + token.length;
      continue;
    }
    if (token.startsWith("*")) {
      pushText(token.slice(1, -1), [{ type: "ITALIC" }]);
      cursor = index + token.length;
      continue;
    }
    const trailing = /[),.;!?]+$/.exec(token)?.[0] ?? "";
    const candidate = trailing ? token.slice(0, -trailing.length) : token;
    let safeUrl = "";
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") safeUrl = parsed.href;
    } catch {
      safeUrl = "";
    }
    pushText(candidate, safeUrl ? [{ type: "LINK", linkData: { link: { url: safeUrl, target: "BLANK", rel: { noreferrer: true } } } }] : []);
    if (trailing) pushText(trailing);
    cursor = index + token.length;
  }
  if (cursor < text.length) pushText(text.slice(cursor));
  if (nodes.length === 0) pushText(text);
  return nodes;
}

export function articleDocumentToRichContent(value: unknown, sources: CitationSource[] = []): { nodes: RicosNode[] } {
  const document = parseArticleDocument(value);
  const nodes: RicosNode[] = [];

  for (const block of document.blocks) {
    if (block.type === "divider") {
      nodes.push({ type: "DIVIDER" });
      continue;
    }
    if (block.type === "image") {
      nodes.push({
        type: "IMAGE",
        imageData: {
            image: { src: { id: block.media.id }, width: block.media.width, height: block.media.height },
            altText: block.altText,
            caption: block.caption,
            containerData: {
              width: { size: block.width },
              alignment: block.alignment,
              textWrap: block.textWrap,
            },
            styles: {
              border: {
                width: block.borderWidth,
                color: block.borderColor,
                radius: block.borderRadius,
              },
            },
          },
      });
      continue;
    }

    const isHeading = block.type === "heading";
    const isQuote = block.type === "quote";
    const isList = block.type === "list";
    const blockStyle = block.style;
    const family = blockStyle.fontFamily || (isHeading ? document.appearance.headingFontFamily : document.appearance.bodyFontFamily);
    const size = blockStyle.fontSize || (isHeading ? document.appearance.headingFontSize : document.appearance.bodyFontSize);
    const color = blockStyle.color || (isHeading ? document.appearance.headingColor : document.appearance.bodyColor);
    const textAlignment = blockStyle.textAlignment === "INHERIT" ? document.appearance.textAlignment : blockStyle.textAlignment;
    const lineHeight = blockStyle.lineHeight || document.appearance.lineHeight;
    const sharedTextStyle = {
      textAlignment,
      lineHeight: String(lineHeight),
      fontSize: { unit: "PX", value: size },
    };
    const style = nodeStyle(blockStyle);

    if (isList) {
      const listNodes: RicosNode[] = block.items.map((item) => ({
        type: "LIST_ITEM",
        nodes: [{
          type: "PARAGRAPH",
          nodes: textDecorations(item, family, size, color, sources),
          paragraphData: { textStyle: sharedTextStyle },
        }],
      }));
      nodes.push({ type: "BULLETED_LIST", nodes: listNodes, bulletedListData: {}, ...(style ? { style } : {}) });
      continue;
    }

    const text = block.text;
    if (isHeading) {
      nodes.push({
        type: "HEADING",
        nodes: textDecorations(text, family, size, color, sources),
        headingData: { level: block.level, textStyle: sharedTextStyle },
        ...(style ? { style } : {}),
      });
    } else if (isQuote) {
      nodes.push({
        type: "BLOCKQUOTE",
        nodes: [{
          type: "PARAGRAPH",
          nodes: textDecorations(text, family, size, color, sources),
          paragraphData: { textStyle: sharedTextStyle },
        }],
        blockquoteData: { indentation: 1 },
        ...(style ? { style } : {}),
      });
    } else {
      nodes.push({
        type: "PARAGRAPH",
        nodes: textDecorations(text, family, size, color, sources),
        paragraphData: { textStyle: sharedTextStyle },
        ...(style ? { style } : {}),
      });
    }
  }

  const result = { nodes };
  const bytes = new TextEncoder().encode(JSON.stringify(result)).byteLength;
  if (bytes > 350000) throw new ArticleDocumentError("The formatted article is too large for a Wix Blog draft.");
  return result;
}
