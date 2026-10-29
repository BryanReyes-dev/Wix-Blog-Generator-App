import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { httpClient } from "@wix/essentials";

type GeneratedArticle = {
  title: string;
  introduction: string;
  sections: Array<{ heading: string; body: string }>;
  conclusion: string;
  metaDescription: string;
  seoKeywords: string[];
};

type ResearchLink = { id: string; url: string; notes: string };
type ResearchSource = {
  id: string;
  title: string;
  url: string;
  publisher: string;
  retrievedAt: string;
  excerpt: string;
  userNotes?: string;
};
type MediaFrame = { label: string; dataUrl: string };
type MediaReference = {
  id: string;
  name: string;
  kind: "image" | "video";
  notes: string;
  frames: MediaFrame[];
  originalBytes: number;
};
type MemberIdentity = { memberId: string; displayName: string };
type Theme = "dark" | "light";
type Preferences = {
  theme: Theme;
  topic: string;
  audience: string;
  tone: string;
  instructions: string;
  keywords: string;
  researchLinks: Array<{ url: string; notes: string }>;
};
type ApiError = { error?: string };
type ApiSuccess<T> = T & { error?: never };
type StatusKind = "info" | "error" | "success";
type ReviewData = {
  article: GeneratedArticle;
  sources: ResearchSource[];
  generatedBy: string;
};

type BlogWorkflowProps = {
  identity: MemberIdentity;
  signOut: () => Promise<void>;
};

const API_BASE_URL = new URL(import.meta.url).origin;
const MAX_RESEARCH_LINKS = 5;
const MAX_MEDIA_FILES = 4;
const MAX_VISUAL_FRAMES = 8;
const MAX_SINGLE_FRAME_CHARS = 850_000;
const MAX_MEDIA_REFERENCE_CHARS = 3_500_000;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ACCEPTED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

const DARK_THEME_TOKENS =
  "[--page:#0a0d13] [--surface:#121722] [--surface-raised:#1a2230] [--surface-soft:#202a3a] [--border:#2e394b] [--border-strong:#44536a] [--text:#f1f5fb] [--text-muted:#a5b1c2] [--text-soft:#7c8ba0] [--accent:#8db7ff] [--accent-strong:#4a8dff] [--accent-text:#071326] [--focus:rgb(117_170_255_/_40%)] [--danger-bg:#351a22] [--danger-border:#7b3948] [--danger-text:#ffc3cf] [--success-bg:#123025] [--success-border:#29664a] [--success-text:#b7f2ce] [--chip-bg:#1e3557] [--chip-text:#c4dcff]";
const LIGHT_THEME_TOKENS =
  "[--page:#f3f6fb] [--surface:#ffffff] [--surface-raised:#f8faff] [--surface-soft:#eaf0f8] [--border:#d8e0ed] [--border-strong:#b4c1d5] [--text:#1b2433] [--text-muted:#506077] [--text-soft:#66758b] [--accent:#255fba] [--accent-strong:#1f61c5] [--accent-text:#ffffff] [--focus:rgb(37_95_186_/_18%)] [--danger-bg:#fff2f4] [--danger-border:#e7aab5] [--danger-text:#8e2537] [--success-bg:#effbf4] [--success-border:#a9d7bc] [--success-text:#16633e] [--chip-bg:#e5efff] [--chip-text:#244b82]";

const INPUT_CLASS =
  "block w-full min-w-0 rounded-xl border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 py-3 text-sm leading-6 text-[var(--text)] placeholder:text-[var(--text-soft)] focus:border-[var(--accent-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]";
const TEXTAREA_CLASS = INPUT_CLASS + " min-h-24 resize-y";
const BUTTON_BASE_CLASS =
  "inline-flex min-h-10 max-w-full items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold leading-5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--page)] disabled:cursor-not-allowed disabled:opacity-50";
const PRIMARY_BUTTON_CLASS =
  BUTTON_BASE_CLASS + " border-transparent bg-[var(--accent)] text-[var(--accent-text)] hover:brightness-105";
const SECONDARY_BUTTON_CLASS =
  BUTTON_BASE_CLASS + " border-[var(--border-strong)] bg-[var(--surface-raised)] text-[var(--text)] hover:bg-[var(--surface-soft)]";
const SOFT_BUTTON_CLASS =
  BUTTON_BASE_CLASS + " border-[var(--border-strong)] bg-[var(--surface-soft)] text-[var(--text)] hover:bg-[var(--surface-raised)]";
const ICON_BUTTON_CLASS =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] text-2xl font-normal leading-none text-[var(--text-muted)] hover:bg-[var(--surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:cursor-not-allowed disabled:opacity-50";
const PANEL_CLASS =
  "grid min-w-0 content-start gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 lg:p-6";

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function makeId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : String(Date.now()) + "-" + Math.random().toString(36).slice(2);
}

function makeSubmissionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
    throw new Error("This browser cannot create a secure draft submission ID. Use a current browser and try again.");
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" +
    hex.slice(16, 20) + "-" + hex.slice(20);
}

function loadPreferences(storageKey: string | null): Partial<Preferences> {
  if (!storageKey) return {};
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const value = JSON.parse(raw) as Partial<Preferences>;
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function savePreferences(storageKey: string | null, preferences: Preferences) {
  if (!storageKey) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(preferences));
  } catch {
    // Browser privacy settings or storage quotas must not block article generation.
  }
}

function articleBody(article: GeneratedArticle, sources: ResearchSource[] = []): string {
  const body = [
    "## Introduction",
    article.introduction,
    ...article.sections.flatMap((section) => ["## " + section.heading, section.body]),
    "## Conclusion",
    article.conclusion,
  ];
  const articleText = body.join("\n");
  const citedIds = new Set([...articleText.matchAll(/\[(S\d+)\]/g)].map((match) => match[1]));
  const citedSources = sources.filter((source) => citedIds.has(source.id));

  if (citedSources.length > 0) {
    body.push("## Sources");
    for (const source of citedSources) {
      body.push("- [" + source.id + "] " + source.title + " — " + source.url);
    }
  }
  return body.join("\n\n");
}

async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const response = await httpClient.fetchWithAuth(API_BASE_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "The request failed. Check your permissions and site setup.";
    try {
      const result = await response.json() as ApiError;
      if (typeof result.error === "string") message = result.error;
    } catch {
      // Keep the safe fallback for non-JSON error responses.
    }
    throw new Error(message);
  }
  return await response.json() as T;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function waitForEvent(
  target: EventTarget,
  successEvent: string,
  errorEvent: string,
  timeoutMs = 12_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => finish(new Error("Timed out while reading the media file.")), timeoutMs);
    const onSuccess = () => finish();
    const onError = () => finish(new Error("This media file could not be decoded in your browser."));
    const finish = (error?: Error) => {
      window.clearTimeout(timer);
      target.removeEventListener(successEvent, onSuccess);
      target.removeEventListener(errorEvent, onError);
      if (error) reject(error);
      else resolve();
    };
    target.addEventListener(successEvent, onSuccess, { once: true });
    target.addEventListener(errorEvent, onError, { once: true });
  });
}

function canvasJpeg(source: CanvasImageSource, width: number, height: number, label: string): MediaFrame {
  const maxDimension = 1440;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const baseWidth = Math.max(1, Math.round(width * scale));
  const baseHeight = Math.max(1, Math.round(height * scale));
  const dimensionScales = [1, 0.82, 0.68, 0.55];
  const qualities = [0.78, 0.65, 0.52];

  for (const dimensionScale of dimensionScales) {
    const outputWidth = Math.max(1, Math.round(baseWidth * dimensionScale));
    const outputHeight = Math.max(1, Math.round(baseHeight * dimensionScale));
    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare this image.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, outputWidth, outputHeight);
    context.drawImage(source, 0, 0, outputWidth, outputHeight);
    for (const quality of qualities) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrl.length <= MAX_SINGLE_FRAME_CHARS) return { label, dataUrl };
    }
  }
  throw new Error("This image is too detailed to attach. Try a smaller image.");
}

async function imageReference(file: File): Promise<MediaFrame> {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  try {
    const loaded = waitForEvent(image, "load", "error");
    image.src = objectUrl;
    await loaded;
    return canvasJpeg(image, image.naturalWidth, image.naturalHeight, "Image");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function videoReferenceFrames(file: File, maxFrames: number): Promise<MediaFrame[]> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;

  try {
    const metadataLoaded = waitForEvent(video, "loadedmetadata", "error");
    video.src = objectUrl;
    video.load();
    await metadataLoaded;
    if (!Number.isFinite(video.duration) || video.duration <= 0 || !video.videoWidth || !video.videoHeight) {
      throw new Error("This video has no readable visual frames.");
    }

    const positions = [0.18, 0.5, 0.82].slice(0, Math.max(1, Math.min(3, maxFrames)));
    const frames: MediaFrame[] = [];
    for (const position of positions) {
      const time = Math.max(0, Math.min(video.duration - 0.08, video.duration * position));
      if (Math.abs(video.currentTime - time) > 0.02) {
        const seeked = waitForEvent(video, "seeked", "error");
        video.currentTime = time;
        await seeked;
      }
      frames.push(canvasJpeg(video, video.videoWidth, video.videoHeight, "Frame at " + Math.round(position * 100) + "%"));
    }
    return frames;
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

function getMediaKind(file: File): "image" | "video" | null {
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  const mimeType = file.type.toLowerCase();
  if (ACCEPTED_IMAGE_TYPES.has(mimeType) || ["jpg", "jpeg", "png", "webp", "gif"].includes(extension)) return "image";
  if (ACCEPTED_VIDEO_TYPES.has(mimeType) || ["mp4", "webm", "mov"].includes(extension)) return "video";
  return null;
}

type FieldProps = {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
};

function Field({ id, label, required = false, hint, children }: FieldProps) {
  return (
    <div className="grid min-w-0 gap-2">
      <label htmlFor={id} className="block text-[13px] font-semibold leading-5 text-[var(--text)]">
        {label}{required ? " *" : ""}
      </label>
      {children}
      {hint ? <small className="break-words text-xs leading-5 text-[var(--text-soft)]">{hint}</small> : null}
    </div>
  );
}

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="grid gap-1">
      <h3 className="m-0 text-lg font-bold tracking-tight text-[var(--text)]">{title}</h3>
      {description ? <p className="m-0 break-words text-sm leading-6 text-[var(--text-muted)]">{description}</p> : null}
    </div>
  );
}

function InlinePreview({ value, sources }: { value: string; sources: ResearchSource[] }) {
  const tokens = value.split(/(\[S\d+\]|https?:\/\/[^\s<>"']+|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g).filter(Boolean);

  return (
    <>
      {tokens.map((token, index) => {
        const citation = /^\[(S\d+)\]$/.exec(token);
        if (citation) {
          const source = sources.find((entry) => entry.id === citation[1]);
          if (!source) return <span key={index}>{token}</span>;
          return (
            <sup key={index} className="ml-0.5 font-sans text-[0.72em]">
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={"Open research source " + source.id + " in a new tab"}
                className="text-[var(--accent)] underline decoration-1 underline-offset-2"
              >
                {token}
              </a>
            </sup>
          );
        }

        if (token.startsWith("**") && token.endsWith("**")) {
          return <strong key={index} className="font-bold text-[var(--text)]">{token.slice(2, -2)}</strong>;
        }
        if (token.startsWith("*") && token.endsWith("*")) {
          return <em key={index} className="italic">{token.slice(1, -1)}</em>;
        }

        if (token.startsWith("http://") || token.startsWith("https://")) {
          const trailing = /[),.;!?]+$/.exec(token)?.[0] ?? "";
          const target = trailing ? token.slice(0, -trailing.length) : token;
          try {
            const url = new URL(target);
            if (url.protocol === "http:" || url.protocol === "https:") {
              return (
                <span key={index}>
                  <a href={url.href} target="_blank" rel="noopener noreferrer" className="break-words text-[var(--accent)] underline underline-offset-2">
                    {target}
                  </a>
                  {trailing}
                </span>
              );
            }
          } catch {
            // Treat malformed URLs as ordinary text in the preview.
          }
        }
        return <span key={index}>{token}</span>;
      })}
    </>
  );
}

function PreviewBlocks({ body, sources }: { body: string; sources: ResearchSource[] }) {
  const blocks: ReactNode[] = [];
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    blocks.push(
      <p key={"paragraph-" + blocks.length} className="mb-4 mt-0 break-words leading-8 text-[var(--text-muted)]">
        <InlinePreview value={paragraphLines.join(" ")} sources={sources} />
      </p>,
    );
    paragraphLines = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(
      <ul key={"list-" + blocks.length} className="mb-4 mt-0 list-disc space-y-2 pl-6 text-[var(--text-muted)]">
        {listItems.map((item, index) => (
          <li key={index} className="pl-1"><InlinePreview value={item} sources={sources} /></li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = Math.min(4, Math.max(2, headingMatch[1]?.length ?? 2));
      const headingClass = "mb-2 mt-6 font-sans font-bold leading-snug text-[var(--text)]";
      if (level === 2) {
        blocks.push(<h2 key={"heading-" + blocks.length} className={headingClass + " text-xl"}><InlinePreview value={headingMatch[2] ?? ""} sources={sources} /></h2>);
      } else if (level === 3) {
        blocks.push(<h3 key={"heading-" + blocks.length} className={headingClass + " text-lg"}><InlinePreview value={headingMatch[2] ?? ""} sources={sources} /></h3>);
      } else {
        blocks.push(<h4 key={"heading-" + blocks.length} className={headingClass + " text-base"}><InlinePreview value={headingMatch[2] ?? ""} sources={sources} /></h4>);
      }
      continue;
    }

    const listMatch = /^[-*]\s+(.+)$/.exec(trimmed);
    if (listMatch) {
      flushParagraph();
      listItems.push(listMatch[1] ?? "");
      continue;
    }

    const quoteMatch = /^>\s?(.+)$/.exec(trimmed);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      blocks.push(
        <blockquote key={"quote-" + blocks.length} className="my-5 border-l-4 border-[var(--border-strong)] py-1 pl-4 text-[var(--text)]">
          <InlinePreview value={quoteMatch[1] ?? ""} sources={sources} />
        </blockquote>,
      );
      continue;
    }

    flushList();
    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushList();
  return <>{blocks}</>;
}

function ResearchSources({ sources }: { sources: ResearchSource[] }) {
  if (sources.length === 0) return null;

  return (
    <section className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm leading-6 text-[var(--text-muted)] sm:p-5">
      <h4 className="m-0 font-bold text-[var(--text)]">Research links retrieved</h4>
      <ol className="mb-0 mt-3 grid gap-4 break-words pl-5">
        {sources.map((source) => (
          <li key={source.id} className="pl-1">
            <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] underline underline-offset-2">
              [{source.id}] {source.title}
            </a>
            <small className="mt-1 block text-[11px] leading-5 text-[var(--text-soft)]">
              {source.publisher} · Retrieved {new Date(source.retrievedAt).toLocaleString()}
            </small>
            {source.userNotes ? <p className="mb-0 mt-2 text-xs leading-5">Your focus: {source.userNotes}</p> : null}
            {source.excerpt ? <p className="mb-0 mt-2 text-xs leading-5">{source.excerpt}</p> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function ResearchLinkCard({
  link,
  index,
  onChange,
  onRemove,
}: {
  link: ResearchLink;
  index: number;
  onChange: (id: string, field: "url" | "notes", value: string) => void;
  onRemove: (id: string) => void;
}) {
  const urlId = "research-url-" + link.id;
  const noteId = "research-note-" + link.id;

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-3 sm:gap-3">
      <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
        <Field id={urlId} label={"URL " + (index + 1)}>
          <input
            id={urlId}
            name={urlId}
            type="url"
            maxLength={2048}
            placeholder="https://example.com/article"
            value={link.url}
            onChange={(event) => onChange(link.id, "url", event.target.value)}
            className={INPUT_CLASS}
          />
        </Field>
        <Field id={noteId} label="Source focus note (optional)">
          <textarea
            id={noteId}
            name={noteId}
            rows={2}
            maxLength={500}
            placeholder="Optional: what should the model focus on in this source?"
            value={link.notes}
            onChange={(event) => onChange(link.id, "notes", event.target.value)}
            className={TEXTAREA_CLASS + " min-h-16"}
          />
        </Field>
      </div>
      <button
        type="button"
        title="Remove link"
        aria-label={"Remove research link " + (index + 1)}
        onClick={() => onRemove(link.id)}
        className={ICON_BUTTON_CLASS}
      >
        ×
      </button>
    </div>
  );
}

function MediaReferenceCard({
  reference,
  onNoteChange,
  onRemove,
}: {
  reference: MediaReference;
  onNoteChange: (id: string, value: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-3 sm:grid-cols-[82px_minmax(0,1fr)_auto]">
      <img
        src={reference.frames[0]?.dataUrl ?? ""}
        alt={reference.name + " preview"}
        className="col-span-2 h-28 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] object-cover sm:col-span-1 sm:h-[72px] sm:w-[82px]"
      />
      <div className="grid min-w-0 gap-2 sm:col-span-1">
        <div className="grid min-w-0 gap-1">
          <strong className="break-words text-[13px] text-[var(--text)]">{reference.name}</strong>
          <small className="break-words text-xs leading-5 text-[var(--text-soft)]">
            {(reference.kind === "video" ? "Video · " + reference.frames.length + " sampled frames" : "Image reference") +
              " · " + formatBytes(reference.originalBytes)}
          </small>
        </div>
        <textarea
          rows={2}
          maxLength={500}
          aria-label={"Context for " + reference.name}
          placeholder="Optional context for the model (up to 500 characters)"
          value={reference.notes}
          onChange={(event) => onNoteChange(reference.id, event.target.value)}
          className={TEXTAREA_CLASS + " min-h-16"}
        />
      </div>
      <button
        type="button"
        aria-label={"Remove file " + reference.name}
        title="Remove file"
        onClick={() => onRemove(reference.id)}
        className={cx("col-start-2 row-start-1", ICON_BUTTON_CLASS, "sm:col-start-3 sm:row-start-1")}
      >
        ×
      </button>
    </div>
  );
}

function ArticleReview({
  review,
  identity,
  reportStatus,
}: {
  review: ReviewData;
  identity: MemberIdentity;
  reportStatus: (message: string, kind?: StatusKind) => void;
}) {
  const [title, setTitle] = useState(review.article.title);
  const [body, setBody] = useState(() => articleBody(review.article, review.sources));
  const [metaDescription, setMetaDescription] = useState(review.article.metaDescription);
  const [keywords, setKeywords] = useState(review.article.seoKeywords.join(", "));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const applyMarkdown = (action: "heading" | "bold" | "italic" | "bullet" | "quote") => {
    const textarea = bodyRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = body.slice(start, end) || "Text";
    let nextBody = body;
    let selectionStart = start;
    let selectionEnd = start;

    if (action === "heading") {
      const lineStart = body.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
      nextBody = body.slice(0, lineStart) + "## " + body.slice(lineStart);
      selectionStart = start + (start >= lineStart ? 3 : 0);
      selectionEnd = end + (end >= lineStart ? 3 : 0);
    } else {
      let replacement = selected;
      if (action === "bold") replacement = "**" + selected + "**";
      if (action === "italic") replacement = "*" + selected + "*";
      if (action === "bullet") replacement = selected.split("\n").map((line) => "- " + line).join("\n");
      if (action === "quote") replacement = selected.split("\n").map((line) => "> " + line).join("\n");
      nextBody = body.slice(0, start) + replacement + body.slice(end);
      selectionStart = start;
      selectionEnd = start + replacement.length;
    }

    setBody(nextBody);
    window.requestAnimationFrame(() => {
      if (!bodyRef.current) return;
      bodyRef.current.focus();
      bodyRef.current.setSelectionRange(selectionStart, selectionEnd);
    });
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;

    const seoKeywords = keywords.split(",").map((term) => term.trim()).filter(Boolean);
    if (seoKeywords.length > 5 || seoKeywords.some((term) => term.length > 80)) {
      reportStatus("Use no more than five SEO keywords, each 80 characters or fewer.", "error");
      return;
    }
    if (!review.generatedBy || review.generatedBy !== identity.memberId) {
      reportStatus("The article creator could not be verified. Generate the article again before saving.", "error");
      return;
    }

    setSaving(true);
    setSaved(false);
    reportStatus("Checking Wix Blog and saving the unpublished draft…");
    try {
      const activeSubmissionId = submissionId ?? makeSubmissionId();
      setSubmissionId(activeSubmissionId);
      const result = await postJson<ApiSuccess<{ draft: { draftId: string; status: string } }>>(
        "/api/workflow/drafts",
        {
          submissionId: activeSubmissionId,
          generatedByMemberId: review.generatedBy,
          title,
          body,
          metaDescription,
          seoKeywords,
          researchSources: review.sources.map(({ id, title: sourceTitle, url }) => ({
            id,
            title: sourceTitle,
            url,
          })),
        },
      );

      if (!result.draft?.draftId || result.draft.status !== "UNPUBLISHED") {
        throw new Error("Wix did not confirm an unpublished draft. Check Wix Blog before retrying.");
      }
      setSaved(true);
      reportStatus(
        "Saved as an unpublished Wix Blog draft (" + result.draft.draftId + "). It has not been published.",
        "success",
      );
    } catch (error) {
      reportStatus(
        error instanceof Error ? error.message : "Unable to save the draft. Check Wix Blog before retrying.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const toolbarActions: Array<{ label: string; action: "heading" | "bold" | "italic" | "bullet" | "quote" }> = [
    { label: "H2", action: "heading" },
    { label: "Bold", action: "bold" },
    { label: "Italic", action: "italic" },
    { label: "• List", action: "bullet" },
    { label: "Quote", action: "quote" },
  ];

  return (
    <section aria-label="Review generated article" className="grid min-w-0 gap-4">
      <div className="grid gap-1">
        <h3 className="m-0 text-lg font-bold text-[var(--text)]">Review and edit</h3>
        <p className="m-0 break-words text-sm leading-6 text-[var(--text-muted)]">
          Nothing is saved to Wix Blog until you choose “Create unpublished draft.”
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:px-4">
        <span className="inline-flex min-h-7 max-w-full items-center rounded-full bg-[var(--chip-bg)] px-3 py-1 text-xs font-bold text-[var(--chip-text)]">
          Generated by {identity.displayName}
        </span>
        <small className="text-xs leading-5 text-[var(--text-soft)]">Wix member identity verified by the server</small>
      </div>

      <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <div className="grid min-w-0 gap-3">
          <h4 className="m-0 text-base font-bold text-[var(--text)]">Editor</h4>
          <form onSubmit={handleSave} className="grid min-w-0 gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-5">
            <Field id="draft-title" label="Title" required>
              <input
                id="draft-title"
                name="title"
                maxLength={200}
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Article title"
                className={INPUT_CLASS}
              />
            </Field>

            <div className="flex flex-wrap gap-2" aria-label="Text formatting tools">
              {toolbarActions.map((item) => (
                <button
                  key={item.action}
                  type="button"
                  onClick={() => applyMarkdown(item.action)}
                  className={cx(SECONDARY_BUTTON_CLASS, "min-h-9 rounded-lg px-3 py-1.5 text-xs")}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <Field
              id="draft-body"
              label="Article content"
              required
              hint="Use the toolbar to format selected text. Headings use Markdown-style “## Heading”."
            >
              <textarea
                ref={bodyRef}
                id="draft-body"
                name="body"
                rows={18}
                maxLength={30_000}
                required
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Article content"
                className={TEXTAREA_CLASS + " min-h-72"}
              />
            </Field>

            <Field
              id="draft-meta-description"
              label="Meta description"
              required
              hint="Edit the description used for search snippets."
            >
              <textarea
                id="draft-meta-description"
                name="metaDescription"
                rows={3}
                maxLength={500}
                required
                value={metaDescription}
                onChange={(event) => setMetaDescription(event.target.value)}
                placeholder="Meta description"
                className={TEXTAREA_CLASS}
              />
            </Field>

            <Field id="draft-seo-keywords" label="SEO keywords">
              <input
                id="draft-seo-keywords"
                name="seoKeywords"
                maxLength={400}
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
                placeholder="Separate up to five keywords with commas"
                className={INPUT_CLASS}
              />
            </Field>

            <button type="submit" disabled={saving || saved} className={PRIMARY_BUTTON_CLASS + " w-fit"}>
              {saving ? "Saving draft…" : saved ? "Draft saved" : "Create unpublished draft"}
            </button>
          </form>
        </div>

        <section aria-label="Visitor-style article preview" className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] bg-[var(--surface-raised)] p-4 sm:px-5">
            <h4 className="m-0 text-base font-bold text-[var(--text)]">Live preview</h4>
            <p className="mb-0 mt-1 break-words text-xs leading-5 text-[var(--text-soft)]">
              The preview updates as you edit. Final presentation depends on the Wix Blog theme.
            </p>
          </div>
          <article className="min-w-0 break-words bg-[var(--surface)] p-4 font-serif text-base leading-8 text-[var(--text-muted)] sm:p-6">
            <h1 className="mb-4 mt-0 break-words font-sans text-2xl font-bold leading-tight tracking-tight text-[var(--text)] sm:text-3xl">
              {title.trim() || "Your article title"}
            </h1>
            <p className="mb-6 mt-0 break-words font-sans text-xs leading-6 text-[var(--text-muted)]">{metaDescription}</p>
            <div className="min-w-0 break-words">
              <PreviewBlocks body={body} sources={review.sources} />
            </div>
          </article>
        </section>
      </div>

      <ResearchSources sources={review.sources} />
    </section>
  );
}

export default function BlogWorkflow({ identity, signOut }: BlogWorkflowProps) {
  const storageKey = identity.memberId
    ? "wix-blog-generator:preferences:v1:" + identity.memberId
    : null;
  const [savedPreferences] = useState<Partial<Preferences>>(() => loadPreferences(storageKey));
  const [theme, setTheme] = useState<Theme>(savedPreferences.theme === "light" ? "light" : "dark");
  const [topic, setTopic] = useState(typeof savedPreferences.topic === "string" ? savedPreferences.topic : "");
  const [audience, setAudience] = useState(typeof savedPreferences.audience === "string" ? savedPreferences.audience : "");
  const [tone, setTone] = useState(typeof savedPreferences.tone === "string" ? savedPreferences.tone : "");
  const [instructions, setInstructions] = useState(typeof savedPreferences.instructions === "string" ? savedPreferences.instructions : "");
  const [keywords, setKeywords] = useState(typeof savedPreferences.keywords === "string" ? savedPreferences.keywords : "");
  const [researchLinks, setResearchLinks] = useState<ResearchLink[]>(() => {
    const safeLinks = Array.isArray(savedPreferences.researchLinks)
      ? savedPreferences.researchLinks.slice(0, MAX_RESEARCH_LINKS).filter((entry) => entry && typeof entry.url === "string")
      : [];
    return safeLinks.map((entry) => ({
      id: makeId(),
      url: entry.url,
      notes: typeof entry.notes === "string" ? entry.notes.slice(0, 500) : "",
    }));
  });
  const [mediaReferences, setMediaReferences] = useState<MediaReference[]>([]);
  const [review, setReview] = useState<ReviewData | null>(null);
  const [status, setStatus] = useState<{ message: string; kind: StatusKind }>({ message: "", kind: "info" });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreparingMedia, setIsPreparingMedia] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reportStatus = (message: string, kind: StatusKind = "info") => setStatus({ message, kind });

  useEffect(() => {
    savePreferences(storageKey, {
      theme,
      topic,
      audience,
      tone,
      instructions,
      keywords,
      researchLinks: researchLinks
        .map((link) => ({ url: link.url, notes: link.notes }))
        .filter((link) => link.url.trim()),
    });
  }, [storageKey, theme, topic, audience, tone, instructions, keywords, researchLinks]);

  const updateResearchLink = (id: string, field: "url" | "notes", value: string) => {
    setResearchLinks((current) => current.map((link) => link.id === id ? { ...link, [field]: value } : link));
  };

  const addResearchLink = () => {
    if (researchLinks.length >= MAX_RESEARCH_LINKS) return;
    setResearchLinks((current) => [...current, { id: makeId(), url: "", notes: "" }]);
  };

  const removeResearchLink = (id: string) => {
    setResearchLinks((current) => current.filter((link) => link.id !== id));
  };

  const handleFilesChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    const nextReferences = [...mediaReferences];
    setIsPreparingMedia(true);
    try {
      for (const file of files) {
        if (nextReferences.length >= MAX_MEDIA_FILES) {
          reportStatus("Attach up to " + MAX_MEDIA_FILES + " reference files. Remove a file before adding another.", "error");
          break;
        }

        const kind = getMediaKind(file);
        if (!kind) {
          reportStatus("Unsupported file type for " + file.name + ". Use JPG, PNG, WebP, GIF, MP4, MOV, or WebM.", "error");
          continue;
        }

        const sizeLimit = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
        if (file.size <= 0 || file.size > sizeLimit) {
          reportStatus(file.name + " is too large. Images must be 20 MB or less; videos must be 100 MB or less.", "error");
          continue;
        }

        const existingFrameCount = nextReferences.reduce((total, reference) => total + reference.frames.length, 0);
        const remainingFrames = MAX_VISUAL_FRAMES - existingFrameCount;
        if (remainingFrames <= 0) {
          reportStatus("You can attach up to " + MAX_VISUAL_FRAMES + " visual frames. Remove a reference to make room.", "error");
          break;
        }

        try {
          reportStatus("Preparing " + file.name + " for visual analysis…");
          const frames = kind === "image"
            ? [await imageReference(file)]
            : await videoReferenceFrames(file, remainingFrames);
          const currentEncodedChars = nextReferences.reduce((total, reference) =>
            total + reference.frames.reduce((frameTotal, frame) => frameTotal + frame.dataUrl.length, 0), 0);
          const incomingEncodedChars = frames.reduce((total, frame) => total + frame.dataUrl.length, 0);
          if (currentEncodedChars + incomingEncodedChars > MAX_MEDIA_REFERENCE_CHARS) {
            reportStatus("Reference images are too large together. Remove a file or use smaller files.", "error");
            continue;
          }

          nextReferences.push({
            id: makeId(),
            name: file.name.slice(0, 160),
            kind,
            notes: "",
            frames,
            originalBytes: file.size,
          });
          setMediaReferences([...nextReferences]);
          reportStatus("Attached " + file.name + " as a visual reference.", "success");
        } catch (error) {
          reportStatus(error instanceof Error ? error.message : "Could not read " + file.name + ".", "error");
        }
      }
    } finally {
      setIsPreparingMedia(false);
    }
  };

  const handleGenerate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;

    const incompleteNotes = researchLinks.some((link) => !link.url.trim() && link.notes.trim());
    if (incompleteNotes) {
      reportStatus("Add a URL or remove the notes from each research link row.", "error");
      return;
    }

    const linksForGeneration = researchLinks
      .map((link) => ({ url: link.url.trim(), notes: link.notes.trim() }))
      .filter((link) => link.url);
    if (linksForGeneration.length > MAX_RESEARCH_LINKS) {
      reportStatus("Use no more than five research links.", "error");
      return;
    }

    const mediaCharacters = mediaReferences.reduce((total, reference) =>
      total + reference.frames.reduce((frameTotal, frame) => frameTotal + frame.dataUrl.length, 0), 0);
    if (mediaCharacters > MAX_MEDIA_REFERENCE_CHARS) {
      reportStatus("Visual references are too large. Remove a file or use smaller media.", "error");
      return;
    }

    savePreferences(storageKey, {
      theme,
      topic,
      audience,
      tone,
      instructions,
      keywords,
      researchLinks: linksForGeneration,
    });
    setIsGenerating(true);
    setReview(null);
    reportStatus("Reading sources and generating a structured article…");

    try {
      const result = await postJson<ApiSuccess<{
        article: GeneratedArticle;
        sources: ResearchSource[];
        generatedBy: { memberId: string };
      }>>("/api/workflow/generate", {
        topic,
        audience,
        tone,
        instructions,
        seoKeywords: keywords,
        researchLinks: linksForGeneration,
        mediaReferences: mediaReferences.map(({ name, kind, notes, frames }) => ({ name, kind, notes, frames })),
      });

      if (!result.article?.title || !Array.isArray(result.article.sections) ||
          typeof result.generatedBy?.memberId !== "string" || !result.generatedBy.memberId) {
        throw new Error("The generated article or creator identity could not be verified. Please try again.");
      }
      if (identity.memberId && identity.memberId !== result.generatedBy.memberId) {
        throw new Error("The signed-in Wix member changed during generation. Refresh and generate the article again.");
      }

      const sources = Array.isArray(result.sources) ? result.sources : [];
      setReview({ article: result.article, sources, generatedBy: result.generatedBy.memberId });
      const sourceMessage = sources.length ? " with " + sources.length + " retrieved research source(s)" : "";
      const mediaMessage = mediaReferences.length ? " and " + mediaReferences.length + " visual reference file(s)" : "";
      reportStatus(
        "Article generated" + sourceMessage + mediaMessage + ". Review the preview, edit the article, and save only when ready.",
        "success",
      );
    } catch (error) {
      reportStatus(error instanceof Error ? error.message : "Article generation failed. Please try again.", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const themeButtonLabel = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <div className={cx(
      "box-border flex min-h-full w-full max-w-none min-w-0 flex-col gap-5 bg-[var(--page)] p-3 font-sans text-[var(--text)] sm:gap-6 sm:p-4 lg:p-8",
      theme === "light" ? LIGHT_THEME_TOKENS : DARK_THEME_TOKENS,
    )}>
      <header className="flex min-w-0 flex-col justify-between gap-4 sm:flex-row sm:items-start sm:gap-6">
        <div className="min-w-0">
          <p className="mb-2 mt-0 text-[11px] font-extrabold tracking-[0.13em] text-[var(--accent)]">EDITORIAL WORKSPACE</p>
          <h2 className="m-0 text-2xl font-bold leading-tight tracking-tight text-[var(--text)] sm:text-3xl">Create a Wix Blog draft</h2>
          <p className="mb-0 mt-2 max-w-4xl break-words text-sm leading-6 text-[var(--text-muted)]">
            Build your brief, add research and visual references, then edit and preview before saving an unpublished draft.
          </p>
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 sm:shrink-0 sm:justify-end">
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close workflow menu" : "Open workflow menu"}
            onClick={() => setMenuOpen((open) => !open)}
            className={cx(SECONDARY_BUTTON_CLASS, "sm:hidden")}
          >
            {menuOpen ? "Close" : "Menu"}
          </button>
          <div className={cx("flex min-w-0 flex-col gap-2 sm:flex-row", menuOpen ? "flex" : "hidden sm:flex")}>
            <button
              type="button"
              aria-label={themeButtonLabel}
              aria-pressed={theme === "light"}
              onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
              className={SECONDARY_BUTTON_CLASS}
            >
              {themeButtonLabel}
            </button>
            <button
              type="button"
              onClick={async (event) => {
                const button = event.currentTarget;
                button.disabled = true;
                try {
                  await signOut();
                } catch {
                  reportStatus("Sign-out could not be completed. Please try again.", "error");
                  button.disabled = false;
                }
              }}
              className={SECONDARY_BUTTON_CLASS}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {status.message ? (
        <p
          role="status"
          aria-live="polite"
          className={cx(
            "m-0 break-words rounded-xl border px-3 py-3 text-sm leading-6",
            status.kind === "error" && "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-text)]",
            status.kind === "success" && "border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success-text)]",
            status.kind === "info" && "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)]",
          )}
        >
          {status.message}
        </p>
      ) : <p role="status" aria-live="polite" className="sr-only" />}

      <div className="grid w-full min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(230px,0.28fr)]">
        <section className={PANEL_CLASS}>
          <SectionHeading
            title="Article brief"
            description="Your preferences are remembered for this Wix member account in this browser."
          />

          <form onSubmit={handleGenerate} className="grid min-w-0 gap-4">
            <Field id="blog-topic" label="Topic or working title" required>
              <input
                id="blog-topic"
                name="topic"
                type="text"
                maxLength={200}
                required
                placeholder="Topic or working title"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                className={INPUT_CLASS}
              />
            </Field>

            <Field id="blog-audience" label="Target audience" required>
              <input
                id="blog-audience"
                name="audience"
                type="text"
                maxLength={300}
                required
                placeholder="Who should this article help?"
                value={audience}
                onChange={(event) => setAudience(event.target.value)}
                className={INPUT_CLASS}
              />
            </Field>

            <Field id="blog-tone" label="Writing tone" required>
              <input
                id="blog-tone"
                name="tone"
                type="text"
                maxLength={120}
                required
                placeholder="For example: warm, practical, and confident"
                value={tone}
                onChange={(event) => setTone(event.target.value)}
                className={INPUT_CLASS}
              />
            </Field>

            <Field id="blog-instructions" label="Main points or instructions" required>
              <textarea
                id="blog-instructions"
                name="instructions"
                rows={5}
                maxLength={3000}
                required
                placeholder="Include the points, examples, or instructions the article should cover."
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                className={TEXTAREA_CLASS}
              />
            </Field>

            <Field id="blog-keywords" label="Optional SEO keywords" hint="Up to five suggested keywords.">
              <input
                id="blog-keywords"
                name="keywords"
                type="text"
                maxLength={400}
                placeholder="Separate keywords with commas"
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
                className={INPUT_CLASS}
              />
            </Field>

            <div className="grid min-w-0 gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[13px] font-semibold leading-5 text-[var(--text)]">Research links</span>
                <button
                  type="button"
                  aria-label="Add a research link"
                  title={researchLinks.length >= MAX_RESEARCH_LINKS ? "You can add up to five research links" : "Add another research link"}
                  disabled={researchLinks.length >= MAX_RESEARCH_LINKS}
                  onClick={addResearchLink}
                  className={SOFT_BUTTON_CLASS}
                >
                  + Add link
                </button>
              </div>
              <small className="break-words text-xs leading-5 text-[var(--text-soft)]">
                Add up to five public web pages. You can tell the model what to focus on for each link.
              </small>
              <div className="grid min-w-0 gap-3">
                {researchLinks.length === 0 ? (
                  <p className="m-0 rounded-xl border border-dashed border-[var(--border-strong)] p-3 text-sm leading-6 text-[var(--text-soft)]">
                    No research links added yet. Select “+ Add link” to start.
                  </p>
                ) : researchLinks.map((link, index) => (
                  <ResearchLinkCard
                    key={link.id}
                    link={link}
                    index={index}
                    onChange={updateResearchLink}
                    onRemove={removeResearchLink}
                  />
                ))}
              </div>
            </div>

            <div className="grid min-w-0 gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[13px] font-semibold leading-5 text-[var(--text)]">Visual reference files</span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isPreparingMedia || mediaReferences.length >= MAX_MEDIA_FILES}
                  aria-label="Add image or video reference files"
                  className={SOFT_BUTTON_CLASS}
                >
                  {isPreparingMedia ? "Preparing…" : "+ Add files"}
                </button>
              </div>
              <small className="break-words text-xs leading-5 text-[var(--text-soft)]">
                PNG, JPG/JPEG, WebP, GIF, MP4, MOV, or WebM. Images are resized for AI analysis; videos contribute up to three sampled frames each. Video audio is not analyzed. Reference files are not automatically embedded in the saved blog post.
              </small>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.webm,image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
                aria-label="Choose images or videos"
                onChange={(event) => void handleFilesChange(event)}
                className="sr-only"
                tabIndex={-1}
              />
              <div className="grid min-w-0 gap-3">
                {mediaReferences.length === 0 ? (
                  <p className="m-0 rounded-xl border border-dashed border-[var(--border-strong)] p-3 text-sm leading-6 text-[var(--text-soft)]">
                    No reference files attached.
                  </p>
                ) : mediaReferences.map((reference) => (
                  <MediaReferenceCard
                    key={reference.id}
                    reference={reference}
                    onNoteChange={(id, notes) => setMediaReferences((current) =>
                      current.map((item) => item.id === id ? { ...item, notes } : item),
                    )}
                    onRemove={(id) => setMediaReferences((current) => current.filter((item) => item.id !== id))}
                  />
                ))}
              </div>
            </div>

            <button type="submit" disabled={isGenerating || isPreparingMedia} className={PRIMARY_BUTTON_CLASS + " w-fit"}>
              {isGenerating ? "Generating…" : "Generate article"}
            </button>
          </form>
        </section>

        <aside className={PANEL_CLASS}>
          <SectionHeading title="Workflow tips" />
          <ul className="m-0 grid list-disc gap-3 pl-5 text-[13px] leading-6 text-[var(--text-muted)]">
            <li>Add a short focus note to a link when you want one specific fact or angle emphasized.</li>
            <li>Use image references for visual context and video references for sampled frames.</li>
            <li>Your selected files stay in memory for this session; text settings are saved per member.</li>
            <li>Generation does not create a post. You decide when to save an unpublished draft.</li>
          </ul>
        </aside>
      </div>

      {review ? (
        <ArticleReview
          key={review.generatedBy + "-" + review.article.title}
          review={review}
          identity={identity}
          reportStatus={reportStatus}
        />
      ) : null}
    </div>
  );
}
