import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { BlogBriefInput } from "../../lib/hooks/useBlogWorkflow";
import { ARTICLE_TEMPLATES, DEFAULT_ARTICLE_DESIGN, getArticleTemplate, type ArticleDesignSettings } from "../../lib/article-layout";
import type { MediaReference, ResearchLinkInput } from "../../lib/media-reference-types";
import { formatBytes } from "../../lib/media-reference";
import { ActionButton } from "../ui/ActionButton";
import { FormField } from "../ui/FormField";
import styles from "./BlogWorkflow.module.css";

type BlogBriefFormProps = {
  isGenerating: boolean;
  isPreparingMedia: boolean;
  mediaReferences: MediaReference[];
  onAddMediaFiles: (files: File[]) => Promise<void>;
  onMediaNoteChange: (id: string, notes: string) => void;
  onRemoveMedia: (id: string) => void;
  onGenerate: (brief: BlogBriefInput) => Promise<void>;
};

function newResearchId(): string {
  return crypto.randomUUID();
}

function mediaKindLabel(kind: MediaReference["kind"]): string {
  if (kind === "image") return "Image";
  if (kind === "video") return "Video";
  if (kind === "audio") return "Audio";
  return "Document / download";
}

export function BlogBriefForm({
  isGenerating,
  isPreparingMedia,
  mediaReferences,
  onAddMediaFiles,
  onMediaNoteChange,
  onRemoveMedia,
  onGenerate,
}: BlogBriefFormProps) {
  const [researchLinks, setResearchLinks] = useState<ResearchLinkInput[]>([]);
  const [design, setDesign] = useState<ArticleDesignSettings>({ ...DEFAULT_ARTICLE_DESIGN });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateResearchLink = (id: string, field: "url" | "notes", value: string) => {
    setResearchLinks((current) => current.map((link) =>
      link.id === id ? { ...link, [field]: value } : link,
    ));
  };

  const handleFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length > 0) void onAddMediaFiles(files);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    void onGenerate({
      topic: String(formData.get("topic") ?? ""),
      audience: String(formData.get("audience") ?? ""),
      tone: String(formData.get("tone") ?? ""),
      instructions: String(formData.get("instructions") ?? ""),
      seoKeywords: String(formData.get("seoKeywords") ?? ""),
      design,
      researchLinks: researchLinks.map(({ url, notes }) => ({ url, notes })),
      mediaReferences: mediaReferences.map(({ id, name, kind, notes, frames }) => ({ id, name, kind, notes, frames })),
      mediaFiles: mediaReferences.map(({ id, file }) => ({ referenceId: id, file })),
    });
  };

  return (
    <div className={styles.briefWorkspace}>
      <form className={styles.workflowForm} onSubmit={handleSubmit}>
        <FormField label="Topic or working title" htmlFor="blog-topic" required>
          <input className={styles.workflowInput} id="blog-topic" name="topic" type="text" maxLength={200} placeholder="Topic or working title" required />
        </FormField>

        <FormField label="Target audience" htmlFor="blog-audience" required>
          <input className={styles.workflowInput} id="blog-audience" name="audience" type="text" maxLength={300} placeholder="Who should this article help?" required />
        </FormField>

        <FormField label="Writing tone" htmlFor="blog-tone" required>
          <input className={styles.workflowInput} id="blog-tone" name="tone" type="text" maxLength={120} placeholder="For example: warm, practical, and confident" required />
        </FormField>

        <FormField label="Main points or instructions" htmlFor="blog-instructions" required>
          <textarea className={styles.workflowTextarea} id="blog-instructions" name="instructions" rows={5} maxLength={3000} placeholder="Include the points, examples, or instructions the article should cover." required />
        </FormField>

        <section className={styles.fullWidthGroup} aria-label="Article design">
          <div className={styles.sectionHeadingRow}>
            <div>
              <h3 className={styles.workflowSectionTitle}>Article design</h3>
              <p className={styles.sectionHint}>Choose a reusable starting style. The AI uses only the prebuilt layouts enabled for that style.</p>
            </div>
          </div>
          <div className={styles.articleDesignFields}>
            <FormField label="Design preset" htmlFor="article-template">
              <select className={styles.workflowInput} id="article-template" value={design.templateId} onChange={(event) => {
                const templateId = event.target.value as ArticleDesignSettings["templateId"];
                setDesign((current) => ({ ...current, templateId, accentColor: getArticleTemplate(templateId).accentColor }));
              }}>
                {ARTICLE_TEMPLATES.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select>
            </FormField>
            <FormField label="Accent color" htmlFor="article-accent-color" hint="Preview accent; the published article inherits the Wix site's theme.">
              <input className={styles.articleAccentInput} id="article-accent-color" type="color" value={design.accentColor} onChange={(event) => setDesign((current) => ({ ...current, accentColor: event.target.value.toUpperCase() }))} />
            </FormField>
            <FormField label="Visual density" htmlFor="article-density">
              <select className={styles.workflowInput} id="article-density" value={design.density} onChange={(event) => setDesign((current) => ({ ...current, density: event.target.value as ArticleDesignSettings["density"] }))}>
                <option value="balanced">Balanced</option>
                <option value="visual-rich">Image-forward</option>
                <option value="quiet">Quiet / minimal</option>
              </select>
            </FormField>
          </div>
        </section>

        <div className={styles.fullWidthGroup}>
          <FormField label="Optional SEO keywords" htmlFor="blog-keywords" hint="Separate keywords with commas. Up to five suggested keywords.">
            <input className={styles.workflowInput} id="blog-keywords" name="seoKeywords" type="text" maxLength={400} placeholder="Separate keywords with commas" />
          </FormField>
        </div>

        <section className={styles.fullWidthGroup} aria-label="Research links">
          <div className={styles.sectionHeadingRow}>
            <div>
              <h3 className={styles.workflowSectionTitle}>Research links</h3>
              <p className={styles.sectionHint}>Add up to five public web pages. Each source can include a note about what the AI should focus on.</p>
            </div>
            <button type="button" className={styles.secondaryAction} disabled={researchLinks.length >= 5} onClick={() => setResearchLinks((current) => [...current, { id: newResearchId(), url: "", notes: "" }])}>
              + Add link
            </button>
          </div>

          {researchLinks.length === 0 ? (
            <p className={styles.emptyState}>No research links added. Your article will be generated from the brief alone.</p>
          ) : (
            <div className={styles.researchList}>
              {researchLinks.map((link, index) => (
                <div className={styles.researchCard} key={link.id}>
                  <div className={styles.researchFields}>
                    <FormField label={"Source URL " + (index + 1)} htmlFor={"research-url-" + link.id}>
                      <input className={styles.workflowInput} id={"research-url-" + link.id} type="url" maxLength={2048} placeholder="https://example.com/article" value={link.url} onChange={(event) => updateResearchLink(link.id, "url", event.target.value)} />
                    </FormField>
                    <FormField label="Focus note (optional)" htmlFor={"research-note-" + link.id} hint="Up to 500 characters.">
                      <textarea className={styles.workflowTextarea} id={"research-note-" + link.id} rows={2} maxLength={500} placeholder="What should the article take from this source?" value={link.notes} onChange={(event) => updateResearchLink(link.id, "notes", event.target.value)} />
                    </FormField>
                  </div>
                  <button type="button" className={styles.removeAction} aria-label={"Remove research link " + (index + 1)} onClick={() => setResearchLinks((current) => current.filter((item) => item.id !== link.id))}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.fullWidthGroup} aria-label="Article media">
          <div className={styles.sectionHeadingRow}>
            <div>
              <h3 className={styles.workflowSectionTitle}>Article media</h3>
              <p className={styles.sectionHint}>Add up to four original images, videos, audio tracks, PDFs, documents, or archives. Originals are uploaded to Wix and placed in the article. Image/video frames are also used as AI visual context when your browser can read them.</p>
              <p className={styles.sectionHint}><strong>Public media:</strong> uploaded files are stored as public blog assets so visitors can view or download them. Only attach files you have permission to share publicly; do not upload private or sensitive documents.</p>
            </div>
            <button type="button" className={styles.secondaryAction} disabled={isPreparingMedia || mediaReferences.length >= 4} onClick={() => fileInputRef.current?.click()}>
              {isPreparingMedia ? "Preparing…" : "+ Add media"}
            </button>
          </div>
          <input
            ref={fileInputRef}
            className={styles.fileInput}
            type="file"
            multiple
            accept=".jpg,.jpeg,.jpe,.jfif,.png,.gif,.bmp,.webp,.heic,.heif,.tif,.tiff,.avif,.svg,.mp4,.m4v,.mov,.webm,.avi,.mkv,.mpg,.mpeg,.mpe,.ogv,.wmv,.3gp,.mxf,.vob,.divx,.xvid,.mp3,.wav,.m4a,.aac,.flac,.wma,.aif,.aiff,.pdf,.txt,.csv,.rtf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.7z,.rar"
            aria-label="Choose article media files"
            onChange={handleFilesChange}
          />
          {mediaReferences.length === 0 ? (
            <p className={styles.emptyState}>No media attached. Wix will keep the original file format; browser-generated JPEG frames are only used for AI analysis.</p>
          ) : (
            <div className={styles.mediaList}>
              {mediaReferences.map((reference) => (
                <div className={styles.mediaCard} key={reference.id}>
                  {reference.frames[0]?.dataUrl ? (
                    <img className={styles.mediaThumbnail} src={reference.frames[0].dataUrl} alt={reference.name + " analysis preview"} />
                  ) : (
                    <div className={styles.mediaTypePreview} aria-hidden="true">{mediaKindLabel(reference.kind).toUpperCase()}</div>
                  )}
                  <div className={styles.mediaDetails}>
                    <strong className={styles.mediaName}>{reference.name}</strong>
                    <small className={styles.sectionHint}>
                      {mediaKindLabel(reference.kind)} · {formatBytes(reference.originalBytes)}
                      {reference.frames.length > 0 ? " · " + reference.frames.length + " AI frame(s)" : " · Original preserved"}
                    </small>
                    <textarea className={styles.workflowTextarea} rows={2} maxLength={500} aria-label={"Context for " + reference.name} placeholder="Optional context for the AI and editorial caption" value={reference.notes} onChange={(event) => onMediaNoteChange(reference.id, event.target.value)} />
                  </div>
                  <button type="button" className={styles.removeAction} aria-label={"Remove " + reference.name} onClick={() => onRemoveMedia(reference.id)}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </section>

        <ActionButton type="submit" disabled={isGenerating || isPreparingMedia}>
          {isGenerating ? "Generating and uploading…" : "Generate article"}
        </ActionButton>
      </form>

      <aside className={styles.workflowTips}>
        <h3 className={styles.workflowSectionTitle}>Workflow tips</h3>
        <ul>
          <li>Use source notes to identify the exact facts or angle you want emphasized.</li>
          <li>Image and video frames give the AI visual context; the original files are uploaded separately.</li>
          <li>Audio and documents are included as original downloadable media. Their contents are not currently transcribed or parsed by the AI.</li>
          <li>Review and reposition the uploaded media before you create the unpublished Wix Blog draft.</li>
        </ul>
      </aside>
    </div>
  );
}
