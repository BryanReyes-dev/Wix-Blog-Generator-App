import { useState, type FormEvent } from "react";
import ArticleReview from "./editor/ArticleReview";
import ArticleBriefForm from "./components/ArticleBriefForm";
import StatusBanner from "./components/StatusBanner";
import WorkflowHeader from "./components/WorkflowHeader";
import { MAX_MEDIA_REFERENCE_CHARS, MAX_RESEARCH_LINKS } from "./lib/constants";
import { postJson } from "./lib/api-client";
import { cx, themeTokens } from "./lib/styles";
import { useArticlePreferences } from "./hooks/useArticlePreferences";
import { useVisualReferences } from "./hooks/useVisualReferences";
import type {
  ApiSuccess,
  GeneratedArticle,
  MemberIdentity,
  ReviewData,
  ResearchSource,
  StatusKind,
  WorkflowStatus,
} from "./types";

type Props = {
  identity: MemberIdentity;
  signOut: () => Promise<void>;
};

export default function BlogWorkflow({ identity, signOut }: Props) {
  const preferences = useArticlePreferences(identity.memberId);
  const [review, setReview] = useState<ReviewData | null>(null);
  const [status, setStatus] = useState<WorkflowStatus>({ message: "", kind: "info" });
  const [isGenerating, setIsGenerating] = useState(false);

  const reportStatus = (message: string, kind: StatusKind = "info") => {
    setStatus({ message, kind });
  };

  const visualReferences = useVisualReferences(reportStatus);

  const handleGenerate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;

    const incompleteNotes = preferences.researchLinks.some(
      (link) => !link.url.trim() && link.notes.trim(),
    );
    if (incompleteNotes) {
      reportStatus("Add a URL or remove the notes from each research link row.", "error");
      return;
    }

    const linksForGeneration = preferences.researchLinks
      .map((link) => ({ url: link.url.trim(), notes: link.notes.trim() }))
      .filter((link) => link.url);

    if (linksForGeneration.length > MAX_RESEARCH_LINKS) {
      reportStatus("Use no more than five research links.", "error");
      return;
    }

    const mediaCharacters = visualReferences.mediaReferences.reduce((total, reference) =>
      total + reference.frames.reduce((frameTotal, frame) => frameTotal + frame.dataUrl.length, 0),
    0);

    if (mediaCharacters > MAX_MEDIA_REFERENCE_CHARS) {
      reportStatus("Visual references are too large. Remove a file or use smaller media.", "error");
      return;
    }

    preferences.saveNow(linksForGeneration);
    setIsGenerating(true);
    setReview(null);
    reportStatus("Reading sources and generating a structured article…");

    try {
      const result = await postJson<ApiSuccess<{
        article: GeneratedArticle;
        sources: ResearchSource[];
        generatedBy: { memberId: string };
      }>>("/api/workflow/generate", {
        topic: preferences.topic,
        audience: preferences.audience,
        tone: preferences.tone,
        instructions: preferences.instructions,
        seoKeywords: preferences.keywords,
        researchLinks: linksForGeneration,
        mediaReferences: visualReferences.mediaReferences.map(({ name, kind, notes, frames }) => ({
          name,
          kind,
          notes,
          frames,
        })),
      });

      if (
        !result.article?.title ||
        !Array.isArray(result.article.sections) ||
        typeof result.generatedBy?.memberId !== "string" ||
        !result.generatedBy.memberId
      ) {
        throw new Error("The generated article or creator identity could not be verified. Please try again.");
      }

      if (identity.memberId && identity.memberId !== result.generatedBy.memberId) {
        throw new Error(
          "The signed-in Wix member changed during generation. Refresh and generate the article again.",
        );
      }

      const sources = Array.isArray(result.sources) ? result.sources : [];
      setReview({
        article: result.article,
        sources,
        generatedBy: result.generatedBy.memberId,
      });

      const sourceMessage = sources.length
        ? " with " + sources.length + " retrieved research source(s)"
        : "";
      const mediaMessage = visualReferences.mediaReferences.length
        ? " and " + visualReferences.mediaReferences.length + " visual reference file(s)"
        : "";

      reportStatus(
        "Article generated" + sourceMessage + mediaMessage +
          ". Review the preview, edit the article, and save only when ready.",
        "success",
      );
    } catch (error) {
      reportStatus(
        error instanceof Error ? error.message : "Article generation failed. Please try again.",
        "error",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={cx(
      "box-border flex min-h-full w-full max-w-none min-w-0 flex-col gap-5 bg-[var(--page)] p-3 font-sans text-[var(--text)] sm:gap-6 sm:p-4 lg:p-8",
      themeTokens(preferences.theme),
    )}>
      <WorkflowHeader
        theme={preferences.theme}
        onToggleTheme={() => preferences.setTheme((current) => current === "dark" ? "light" : "dark")}
        onSignOut={signOut}
        onSignOutError={() => reportStatus("Sign-out could not be completed. Please try again.", "error")}
      />

      <StatusBanner status={status} />

      <ArticleBriefForm
        topic={preferences.topic}
        onTopicChange={preferences.setTopic}
        audience={preferences.audience}
        onAudienceChange={preferences.setAudience}
        tone={preferences.tone}
        onToneChange={preferences.setTone}
        instructions={preferences.instructions}
        onInstructionsChange={preferences.setInstructions}
        keywords={preferences.keywords}
        onKeywordsChange={preferences.setKeywords}
        researchLinks={preferences.researchLinks}
        onResearchLinkChange={preferences.updateResearchLink}
        onAddResearchLink={preferences.addResearchLink}
        onRemoveResearchLink={preferences.removeResearchLink}
        mediaReferences={visualReferences.mediaReferences}
        onMediaFilesChange={visualReferences.addFiles}
        onMediaReferenceNoteChange={visualReferences.updateNote}
        onRemoveMediaReference={visualReferences.removeReference}
        isPreparingMedia={visualReferences.isPreparingMedia}
        isGenerating={isGenerating}
        onGenerate={handleGenerate}
      />

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
