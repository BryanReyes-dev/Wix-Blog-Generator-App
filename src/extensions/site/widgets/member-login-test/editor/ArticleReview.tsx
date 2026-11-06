import { useState, type FormEvent } from "react";
import { httpClient } from "@wix/essentials";
import type { ArticleDocument, ArticleMedia } from "../../../../../lib/article-document";
import { articleBodyToDocument, articleDocumentToPlainText } from "../../../../../lib/article-document";
import ArticleEditor from "./ArticleEditor";
import ArticlePreview from "./ArticlePreview";
import { EditorIcon } from "./EditorIcon";
import type { MemberIdentity, ReviewData } from "./types";

const API_BASE_URL = new URL(import.meta.url).origin;
const CONTROL = "mt-1 min-h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)]";
const BUTTON = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-50";
const PRIMARY = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-bold text-[var(--accent-text)] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type Props = {
  review: ReviewData;
  identity: MemberIdentity;
  reportStatus: (message: string, kind?: "info" | "error" | "success") => void;
};

type SourceLink = { id: string; title: string; url: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isImageMimeType(value: string): value is ArticleMedia["mimeType"] {
  return value === "image/jpeg" || value === "image/png" || value === "image/webp" || value === "image/gif";
}

function generatedBody(review: ReviewData): string {
  const body = [
    "## Introduction",
    review.article.introduction,
    ...review.article.sections.flatMap((section) => ["## " + section.heading, section.body]),
    "## Conclusion",
    review.article.conclusion,
  ].join("\n\n");
  const citedIds = new Set(Array.from(body.matchAll(/\[(S\d+)\]/g), (match) => match[1] ?? ""));
  const cited = review.sources.filter((source) => citedIds.has(source.id));
  if (cited.length === 0) return body;
  return body + "\n\n## Sources\n\n" + cited.map((source) => "- [" + source.id + "] " + source.title + " — " + source.url).join("\n");
}

function createSubmissionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  throw new Error("This browser cannot create a secure draft submission ID. Update your browser and try again.");
}

function slugFromTitle(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function imageDimensions(file: File): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const dimensions = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  if (dimensions.width < 1 || dimensions.height < 1 || dimensions.width > 20000 || dimensions.height > 20000) {
    throw new Error("This image has unsupported dimensions.");
  }
  return dimensions;
}

function validateUploadResponse(value: unknown): { fileId: string; uploadToken: string } {
  if (!isRecord(value) || typeof value.fileId !== "string" || typeof value.uploadToken !== "string") {
    throw new Error("Wix Media Manager returned an invalid upload response.");
  }
  return { fileId: value.fileId, uploadToken: value.uploadToken };
}

async function uploadOriginalImage(file: File): Promise<ArticleMedia> {
  if (!isImageMimeType(file.type)) throw new Error("Use a JPEG, PNG, WebP, or GIF image.");
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    throw new Error("Original images must be 10 MB or smaller. Compress the file before uploading.");
  }

  const dimensions = await imageDimensions(file);
  const form = new FormData();
  form.set("file", file);
  const uploadResponse = await httpClient.fetchWithAuth(API_BASE_URL + "/api/workflow/media/upload", {
    method: "POST",
    body: form,
  });
  const uploadPayload = await readJson(uploadResponse);
  if (!uploadResponse.ok) {
    const message = isRecord(uploadPayload) && typeof uploadPayload.error === "string"
      ? uploadPayload.error
      : "Wix Media Manager could not upload this image.";
    throw new Error(message);
  }
  const { fileId, uploadToken } = validateUploadResponse(uploadPayload);
  const query = new URLSearchParams({ fileId, uploadToken });

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const statusResponse = await httpClient.fetchWithAuth(API_BASE_URL + "/api/workflow/media/status?" + query.toString());
    const statusPayload = await readJson(statusResponse);
    if (!statusResponse.ok && statusResponse.status !== 202) {
      const message = isRecord(statusPayload) && typeof statusPayload.error === "string"
        ? statusPayload.error
        : "Wix Media Manager could not confirm that the image is ready.";
      throw new Error(message);
    }
    if (isRecord(statusPayload) && statusPayload.status === "FAILED") {
      throw new Error(typeof statusPayload.error === "string" ? statusPayload.error : "Wix Media Manager failed to process this image.");
    }
    if (isRecord(statusPayload) && statusPayload.status === "READY" && isRecord(statusPayload.media)) {
      const media = statusPayload.media;
      if (
        typeof media.id !== "string" ||
        typeof media.url !== "string" ||
        typeof media.name !== "string" ||
        media.mimeType !== file.type
      ) {
        throw new Error("Wix Media Manager returned incomplete image details.");
      }
      return {
        id: media.id,
        url: media.url,
        name: file.name,
        mimeType: file.type,
        uploadToken,
        width: dimensions.width,
        height: dimensions.height,
      };
    }
    await new Promise<void>((resolve) => window.setTimeout(resolve, 900));
  }
  throw new Error("Wix is still processing this image. Remove it and try again in a moment.");
}

export default function ArticleReview({ review, identity, reportStatus }: Props) {
  const [title, setTitle] = useState(review.article.title);
  const [document, setDocument] = useState<ArticleDocument>(() => articleBodyToDocument(generatedBody(review), createSubmissionId));
  const [metaDescription, setMetaDescription] = useState(review.article.metaDescription);
  const [keywords, setKeywords] = useState(review.article.seoKeywords.join(", "));
  const [seoSlug, setSeoSlug] = useState(() => slugFromTitle(review.article.title));
  const [hashtags, setHashtags] = useState("");
  const [featured, setFeatured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<"editor" | "preview">("editor");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  const handleDocumentChange = (next: ArticleDocument) => {
    setDocument(next);
    setSaved(false);
    setSubmissionId(null);
  };

  const handleTitleChange = (next: string) => {
    setTitle(next);
    setSeoSlug(slugFromTitle(next));
    setSaved(false);
    setSubmissionId(null);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const seoKeywords = keywords.split(",").map((term) => term.trim()).filter(Boolean);
    const tagValues = hashtags.split(",").map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean);
    if (!title.trim()) {
      reportStatus("Add an article title before saving.", "error");
      return;
    }
    if (seoKeywords.length > 5 || seoKeywords.some((term) => term.length > 80)) {
      reportStatus("Use no more than five SEO keywords, each 80 characters or fewer.", "error");
      return;
    }
    if (tagValues.length > 100 || tagValues.some((tag) => tag.length > 100)) {
      reportStatus("Use no more than 100 tags, each 100 characters or fewer.", "error");
      return;
    }
    if (!review.generatedBy || review.generatedBy !== identity.memberId) {
      reportStatus("The article creator could not be verified. Generate the article again before saving.", "error");
      return;
    }
    if (document.blocks.some((block) => block.type === "image" && !block.altText.trim())) {
      reportStatus("Add alternative text to every article image before saving.", "error");
      return;
    }

    setSaving(true);
    setSaved(false);
    reportStatus("Validating article content and saving an unpublished Wix Blog draft…");
    try {
      const activeSubmissionId = submissionId ?? createSubmissionId();
      setSubmissionId(activeSubmissionId);
      const body = articleDocumentToPlainText(document);
      const response = await httpClient.fetchWithAuth(API_BASE_URL + "/api/workflow/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: activeSubmissionId,
          generatedByMemberId: review.generatedBy,
          title: title.trim(),
          body,
          articleDocument: document,
          metaDescription: metaDescription.trim(),
          seoKeywords,
          seoSlug: seoSlug.trim(),
          hashtags: tagValues,
          featured,
          researchSources: review.sources.map((source) => ({ id: source.id, title: source.title, url: source.url })),
        }),
      });
      const payload: unknown = await readJson(response);
      if (!response.ok) {
        const message = isRecord(payload) && typeof payload.error === "string" ? payload.error : "Wix Blog could not save this draft.";
        throw new Error(message);
      }
      if (!isRecord(payload) || !isRecord(payload.draft) || typeof payload.draft.draftId !== "string" || payload.draft.status !== "UNPUBLISHED") {
        throw new Error("Wix did not confirm an unpublished draft. Check Wix Blog before retrying.");
      }
      setSaved(true);
      reportStatus("Saved as an unpublished Wix Blog draft (" + payload.draft.draftId + "). It has not been published.", "success");
    } catch (error) {
      reportStatus(error instanceof Error ? error.message : "Unable to save the draft. Check Wix Blog before retrying.", "error");
    } finally {
      setSaving(false);
    }
  };

  const sources: SourceLink[] = review.sources.map(({ id, title: sourceTitle, url }) => ({ id, title: sourceTitle, url }));

  return (
    <section aria-label="Editorial workspace" className="grid min-w-0 gap-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="m-0 text-lg font-bold text-[var(--text)]">Editorial workspace</h3>
          <p className="mb-0 mt-1 text-sm leading-6 text-[var(--text-muted)]">Edit the article structure, media, and styling. Nothing is saved until you create an unpublished draft.</p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full bg-[var(--chip-bg)] px-3 py-1 text-xs font-bold text-[var(--chip-text)]">Generated by {identity.displayName}</span>
      </div>

      <div className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4 lg:grid-cols-2">
        <label className="text-xs font-semibold text-[var(--text-muted)]">
          Article title
          <input className={CONTROL} maxLength={200} value={title} onChange={(event) => handleTitleChange(event.target.value)} required/>
        </label>
        <label className="text-xs font-semibold text-[var(--text-muted)]">
          Meta description
          <textarea className={CONTROL + " min-h-10 resize-y py-2"} maxLength={500} rows={2} required value={metaDescription} onChange={(event) => { setMetaDescription(event.target.value); setSaved(false); setSubmissionId(null); }}/>
        </label>
      </div>

      <div className="flex items-center gap-2 lg:hidden">
        <label htmlFor="editor-mobile-panel" className="shrink-0 text-xs font-semibold text-[var(--text-muted)]">Workspace</label>
        <select id="editor-mobile-panel" className={CONTROL + " mt-0"} value={mobilePanel} onChange={(event) => setMobilePanel(event.target.value as "editor" | "preview")}>
          <option value="editor">Edit article</option>
          <option value="preview">Preview article</option>
        </select>
      </div>

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
        <div className={mobilePanel === "editor" ? "block min-w-0" : "hidden min-w-0 lg:block"}>
          <ArticleEditor
            value={document}
            onChange={handleDocumentChange}
            onUploadImage={uploadOriginalImage}
            reportStatus={reportStatus}
            disabled={saving}
          />
        </div>

        <div className={mobilePanel === "preview" ? "block min-w-0" : "hidden min-w-0 lg:block"}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="m-0 text-sm font-bold text-[var(--text)]">Preview layout</h3>
            <div className="flex items-center gap-2">
              <button type="button" className={BUTTON} aria-label="Preview desktop layout" title="Desktop preview" aria-pressed={previewDevice === "desktop"} onClick={() => setPreviewDevice("desktop")}><EditorIcon name="desktop" size={16}/><span className="hidden sm:inline">Desktop</span></button>
              <button type="button" className={BUTTON} aria-label="Preview mobile layout" title="Mobile preview" aria-pressed={previewDevice === "mobile"} onClick={() => setPreviewDevice("mobile")}><EditorIcon name="mobile" size={16}/><span className="hidden sm:inline">Mobile</span></button>
            </div>
          </div>
          <ArticlePreview document={document} title={title} metaDescription={metaDescription} sources={sources} device={previewDevice}/>
          {sources.length ? (
            <details className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
              <summary className="cursor-pointer text-sm font-semibold text-[var(--text)]">Research sources ({sources.length})</summary>
              <ul className="mb-0 mt-3 grid gap-2 pl-5 text-xs leading-5 text-[var(--text-muted)]">
                {sources.map((source) => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer" className="text-[var(--accent)] underline">{source.id} · {source.title}</a></li>)}
              </ul>
            </details>
          ) : null}
        </div>
      </div>

      <form onSubmit={handleSave} className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
        <div>
          <h3 className="m-0 text-base font-bold text-[var(--text)]">SEO and publishing details</h3>
          <p className="mb-0 mt-1 text-xs leading-5 text-[var(--text-soft)]">These settings are saved with the unpublished Wix Blog draft.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <label className="text-xs font-semibold text-[var(--text-muted)]">
            SEO URL slug
            <input className={CONTROL} maxLength={100} value={seoSlug} onChange={(event) => { setSeoSlug(event.target.value); setSaved(false); setSubmissionId(null); }} placeholder="article-url-slug"/>
          </label>
          <label className="text-xs font-semibold text-[var(--text-muted)]">
            SEO keywords
            <input className={CONTROL} maxLength={400} value={keywords} onChange={(event) => { setKeywords(event.target.value); setSaved(false); setSubmissionId(null); }} placeholder="Up to five, separated by commas"/>
          </label>
          <label className="text-xs font-semibold text-[var(--text-muted)] lg:col-span-2">
            Tags
            <input className={CONTROL} value={hashtags} onChange={(event) => { setHashtags(event.target.value); setSaved(false); setSubmissionId(null); }} placeholder="fashion, style, trends"/>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <input type="checkbox" checked={featured} onChange={(event) => { setFeatured(event.target.checked); setSaved(false); setSubmissionId(null); }}/>
          Mark this article as featured
        </label>
        <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="m-0 text-xs leading-5 text-[var(--text-soft)]">Saving creates an unpublished draft only. Publication remains a separate Wix action.</p>
          <button type="submit" className={PRIMARY} disabled={saving || saved}>
            <EditorIcon name="save" size={17}/>{saving ? "Saving draft…" : saved ? "Draft saved" : "Create unpublished draft"}
          </button>
        </div>
      </form>
    </section>
  );
}
