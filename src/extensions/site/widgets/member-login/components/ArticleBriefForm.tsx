import { useRef, type ChangeEvent, type FormEvent } from "react";
import { MAX_MEDIA_FILES, MAX_RESEARCH_LINKS } from "../lib/constants";
import {
  INPUT_CLASS,
  PANEL_CLASS,
  PRIMARY_BUTTON_CLASS,
  SOFT_BUTTON_CLASS,
  TEXTAREA_CLASS,
} from "../lib/styles";
import type { MediaReference, ResearchLink } from "../types";
import FormField from "./FormField";
import MediaReferenceCard from "./MediaReferenceCard";
import ResearchLinkCard from "./ResearchLinkCard";
import SectionHeading from "./SectionHeading";

type Props = {
  topic: string;
  onTopicChange: (value: string) => void;
  audience: string;
  onAudienceChange: (value: string) => void;
  tone: string;
  onToneChange: (value: string) => void;
  instructions: string;
  onInstructionsChange: (value: string) => void;
  keywords: string;
  onKeywordsChange: (value: string) => void;
  researchLinks: ResearchLink[];
  onResearchLinkChange: (id: string, field: "url" | "notes", value: string) => void;
  onAddResearchLink: () => void;
  onRemoveResearchLink: (id: string) => void;
  mediaReferences: MediaReference[];
  onMediaFilesChange: (files: File[]) => Promise<void>;
  onMediaReferenceNoteChange: (id: string, notes: string) => void;
  onRemoveMediaReference: (id: string) => void;
  isPreparingMedia: boolean;
  isGenerating: boolean;
  onGenerate: (event: FormEvent<HTMLFormElement>) => void;
};

export default function ArticleBriefForm({
  topic,
  onTopicChange,
  audience,
  onAudienceChange,
  tone,
  onToneChange,
  instructions,
  onInstructionsChange,
  keywords,
  onKeywordsChange,
  researchLinks,
  onResearchLinkChange,
  onAddResearchLink,
  onRemoveResearchLink,
  mediaReferences,
  onMediaFilesChange,
  onMediaReferenceNoteChange,
  onRemoveMediaReference,
  isPreparingMedia,
  isGenerating,
  onGenerate,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length > 0) void onMediaFilesChange(files);
  };

  return (
    <div className="grid w-full min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(230px,0.28fr)]">
      <section className={PANEL_CLASS}>
        <SectionHeading
          title="Article brief"
          description="Your preferences are remembered for this Wix member account in this browser."
        />

        <form onSubmit={onGenerate} className="grid min-w-0 gap-4">
          <FormField id="blog-topic" label="Topic or working title" required>
            <input
              id="blog-topic"
              name="topic"
              type="text"
              maxLength={200}
              required
              placeholder="Topic or working title"
              value={topic}
              onChange={(event) => onTopicChange(event.target.value)}
              className={INPUT_CLASS}
            />
          </FormField>

          <FormField id="blog-audience" label="Target audience" required>
            <input
              id="blog-audience"
              name="audience"
              type="text"
              maxLength={300}
              required
              placeholder="Who should this article help?"
              value={audience}
              onChange={(event) => onAudienceChange(event.target.value)}
              className={INPUT_CLASS}
            />
          </FormField>

          <FormField id="blog-tone" label="Writing tone" required>
            <input
              id="blog-tone"
              name="tone"
              type="text"
              maxLength={120}
              required
              placeholder="For example: warm, practical, and confident"
              value={tone}
              onChange={(event) => onToneChange(event.target.value)}
              className={INPUT_CLASS}
            />
          </FormField>

          <FormField id="blog-instructions" label="Main points or instructions" required>
            <textarea
              id="blog-instructions"
              name="instructions"
              rows={5}
              maxLength={3000}
              required
              placeholder="Include the points, examples, or instructions the article should cover."
              value={instructions}
              onChange={(event) => onInstructionsChange(event.target.value)}
              className={TEXTAREA_CLASS}
            />
          </FormField>

          <FormField id="blog-keywords" label="Optional SEO keywords" hint="Up to five suggested keywords.">
            <input
              id="blog-keywords"
              name="keywords"
              type="text"
              maxLength={400}
              placeholder="Separate keywords with commas"
              value={keywords}
              onChange={(event) => onKeywordsChange(event.target.value)}
              className={INPUT_CLASS}
            />
          </FormField>

          <div className="grid min-w-0 gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-[13px] font-semibold leading-5 text-[var(--text)]">Research links</span>
              <button
                type="button"
                aria-label="Add a research link"
                title={researchLinks.length >= MAX_RESEARCH_LINKS
                  ? "You can add up to five research links"
                  : "Add another research link"}
                disabled={researchLinks.length >= MAX_RESEARCH_LINKS}
                onClick={onAddResearchLink}
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
                  onChange={onResearchLinkChange}
                  onRemove={onRemoveResearchLink}
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
              onChange={handleFilesChange}
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
                  onNoteChange={onMediaReferenceNoteChange}
                  onRemove={onRemoveMediaReference}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isGenerating || isPreparingMedia}
            className={PRIMARY_BUTTON_CLASS + " w-fit"}
          >
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
  );
}
