import { useCallback, useRef, useState } from "react";
import { httpClient } from "@wix/essentials";
import type { GeneratedArticle } from "../blog-content";
import type { ArticleDesignSettings, ArticleSectionLayout } from "../article-layout";
import { createMockDraft, generateMockArticle } from "../dev/mock-blog-workflow";
import { getMediaFileInfo } from "../media-file-types";
import { uploadFileToWix, type WixUploadTarget } from "../media-upload";
import type {
  MediaPlacement,
  MediaReferenceInput,
  ResearchLinkInput,
  ResearchSource,
  UploadedMedia,
} from "../media-reference-types";

const API_BASE_URL = new URL(import.meta.url).origin;

export type BlogBriefInput = {
  topic: string;
  audience: string;
  tone: string;
  instructions: string;
  seoKeywords: string;
  design: ArticleDesignSettings;
  researchLinks: Array<Pick<ResearchLinkInput, "url" | "notes">>;
  mediaReferences: MediaReferenceInput[];
  mediaFiles: Array<{ referenceId: string; file: File }>;
};

type WorkflowNotice = {
  message: string;
  tone: "info" | "error" | "success";
};

type DraftInput = { title: string; body: string; mediaPlacements: MediaPlacement[]; sectionLayouts: ArticleSectionLayout[]; design: ArticleDesignSettings };
type ApiError = { error?: string };
type WorkflowMode = "live" | "mock";

async function postWorkflowJson<T>(path: string, payload: unknown): Promise<T> {
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

function isGeneratedArticle(value: unknown): value is GeneratedArticle {
  if (!value || typeof value !== "object") return false;
  const article = value as Record<string, unknown>;
  return (
    typeof article.title === "string" &&
    typeof article.introduction === "string" &&
    Array.isArray(article.sections) &&
    typeof article.conclusion === "string" &&
    typeof article.metaDescription === "string" &&
    Array.isArray(article.seoKeywords)
  );
}

function isResearchSource(value: unknown): value is ResearchSource {
  if (!value || typeof value !== "object") return false;
  const source = value as Record<string, unknown>;
  return (
    typeof source.id === "string" &&
    typeof source.title === "string" &&
    typeof source.url === "string" &&
    typeof source.publisher === "string" &&
    typeof source.retrievedAt === "string" &&
    typeof source.excerpt === "string"
  );
}

function isUploadedMedia(value: unknown): value is UploadedMedia {
  if (!value || typeof value !== "object") return false;
  const media = value as Record<string, unknown>;
  return (
    typeof media.referenceId === "string" &&
    typeof media.fileId === "string" &&
    typeof media.name === "string" &&
    typeof media.kind === "string" &&
    typeof media.mimeType === "string" &&
    typeof media.fileUrl === "string"
  );
}

export function useBlogWorkflow({ mode = "live" }: { mode?: WorkflowMode } = {}) {
  const [article, setArticle] = useState<GeneratedArticle | null>(null);
  const [sources, setSources] = useState<ResearchSource[]>([]);
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia[]>([]);
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
      message: mode === "mock" ? "Generating a sample article…" : "Uploading original media to Wix before writing…",
      tone: "info",
    });

    try {
      if (mode === "mock") {
        const mockArticle = await generateMockArticle(brief);
        setArticle(mockArticle);
        setUploadedMedia([]);
        setNotice({
          message: "Mock article generated. No original files are uploaded and no Wix Blog draft is created in mock mode.",
          tone: "success",
        });
        return;
      }

      const { mediaFiles, mediaReferences, ...briefFields } = brief;
      const selectedIds = new Set(mediaFiles.map((item) => item.referenceId));
      const existing = new Map(
        uploadedMedia.filter((item) => selectedIds.has(item.referenceId))
          .map((item) => [item.referenceId, item] as const),
      );
      setUploadedMedia(Array.from(existing.values()));

      for (const item of mediaFiles) {
        if (existing.has(item.referenceId)) continue;

        const fileInfo = getMediaFileInfo(item.file.name);
        if (!fileInfo) throw new Error(item.file.name + " is not a supported Wix media type.");

        setNotice({
          message: "Uploading original media to Wix: " + item.file.name,
          tone: "info",
        });
        const target = await postWorkflowJson<WixUploadTarget & { mimeType: string }>(
          "/api/workflow/media-upload-url",
          { fileName: item.file.name, sizeBytes: item.file.size },
        );
        const previewFrame = mediaReferences.find((reference) => reference.id === item.referenceId)?.frames[0];
        const uploaded = await uploadFileToWix(item.file, target.mimeType, target, {
          referenceId: item.referenceId,
          kind: fileInfo.kind,
          ...(previewFrame?.width ? { width: previewFrame.width } : {}),
          ...(previewFrame?.height ? { height: previewFrame.height } : {}),
          ...(previewFrame?.durationSeconds ? { durationSeconds: previewFrame.durationSeconds } : {}),
        });
        existing.set(item.referenceId, uploaded);
        setUploadedMedia(Array.from(existing.values()));
      }

      const allUploaded = Array.from(existing.values()).filter(isUploadedMedia);
      if (allUploaded.length !== mediaFiles.length) {
        throw new Error("Wix did not confirm every original media upload. Retry before generating the article.");
      }

      setNotice({
        message: "Original files uploaded. Researching sources and generating the article…",
        tone: "info",
      });
      const result = await postWorkflowJson<{
        article?: unknown;
        sources?: unknown;
      }>("/api/workflow/generate", {
        ...briefFields,
        mediaReferences,
      });

      if (!isGeneratedArticle(result.article)) {
        throw new Error("The generated article could not be read. Please try again.");
      }

      const verifiedSources = Array.isArray(result.sources)
        ? result.sources.filter(isResearchSource)
        : [];
      setArticle(result.article);
      setSources(verifiedSources);
      setUploadedMedia(allUploaded);
      setNotice({
        message: "Article generated with " + verifiedSources.length +
          " verified research source(s) and " + allUploaded.length +
          " original media file(s) uploaded to Wix. Review the story and media placements before saving.",
        tone: "success",
      });
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : "Article generation or media upload failed. Please try again.",
        tone: "error",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [mode, uploadedMedia]);

  const removeUploadedMedia = useCallback((referenceId: string) => {
    setUploadedMedia((current) => current.filter((item) => item.referenceId !== referenceId));
  }, []);

  const createDraft = useCallback(async ({ title, body, mediaPlacements, sectionLayouts, design }: DraftInput): Promise<void> => {
    if (!article || draftSaved) return;

    setIsSaving(true);
    setNotice({
      message: mode === "mock" ? "Simulating unpublished draft creation…" : "Checking Wix Blog and building your editorial draft…",
      tone: "info",
    });

    try {
      if (mode === "mock") {
        const draft = await createMockDraft({ title, body });
        setDraftSaved(true);
        setNotice({
          message: "Mock draft saved (" + draft.draftId + "). No Wix Blog draft was created.",
          tone: "success",
        });
        return;
      }

      submissionId.current ??= crypto.randomUUID();
      const result = await postWorkflowJson<{
        draft?: { draftId?: unknown; status?: unknown };
      }>("/api/workflow/drafts", {
        submissionId: submissionId.current,
        title,
        body,
        metaDescription: article.metaDescription,
        seoKeywords: article.seoKeywords,
        researchSources: sources.map(({ id, title: sourceTitle, url }) => ({
          id, title: sourceTitle, url,
        })),
        mediaAssets: uploadedMedia.map((mediaItem) => ({
          referenceId: mediaItem.referenceId,
          fileId: mediaItem.fileId,
          name: mediaItem.name,
          kind: mediaItem.kind,
          mimeType: mediaItem.mimeType,
          ...(mediaItem.width ? { width: mediaItem.width } : {}),
          ...(mediaItem.height ? { height: mediaItem.height } : {}),
          ...(mediaItem.durationSeconds ? { durationSeconds: mediaItem.durationSeconds } : {}),
        })),
        mediaPlacements,
        sectionLayouts,
        design,
      });

      const draft = result.draft;
      if (!draft || typeof draft.draftId !== "string" || draft.status !== "UNPUBLISHED") {
        throw new Error("Wix did not confirm an unpublished draft. Check Wix Blog before retrying.");
      }

      setDraftSaved(true);
      setNotice({
        message: "Saved as an unpublished Wix Blog draft (" + draft.draftId + "). The original uploaded media was added to the article; it has not been published.",
        tone: "success",
      });
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : "Unable to save the draft. Check Wix Blog before retrying.",
        tone: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }, [article, draftSaved, mode, sources, uploadedMedia]);

  return {
    article,
    sources,
    uploadedMedia,
    removeUploadedMedia,
    notice,
    isGenerating,
    isSaving,
    draftSaved,
    generateArticle,
    createDraft,
  };
}
