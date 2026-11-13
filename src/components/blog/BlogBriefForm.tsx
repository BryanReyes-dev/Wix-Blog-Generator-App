import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { BlogBriefInput } from '../../lib/hooks/useBlogWorkflow';
import type { MediaReference, ResearchLinkInput } from '../../lib/media-reference-types';
import { ActionButton } from '../ui/ActionButton';
import { FormField } from '../ui/FormField';
import styles from './BlogWorkflow.module.css';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateResearchLink = (id: string, field: 'url' | 'notes', value: string) => {
    setResearchLinks((current) => current.map((link) =>
      link.id === id ? { ...link, [field]: value } : link,
    ));
  };

  const handleFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length > 0) void onAddMediaFiles(files);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    void onGenerate({
      topic: String(formData.get('topic') ?? ''),
      audience: String(formData.get('audience') ?? ''),
      tone: String(formData.get('tone') ?? ''),
      instructions: String(formData.get('instructions') ?? ''),
      seoKeywords: String(formData.get('seoKeywords') ?? ''),
      researchLinks: researchLinks.map(({ url, notes }) => ({ url, notes })),
      mediaReferences: mediaReferences.map(({ name, kind, notes, frames }) => ({
        name, kind, notes, frames,
      })),
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
            <button type="button" className={styles.secondaryAction} disabled={researchLinks.length >= 5} onClick={() => setResearchLinks((current) => [...current, { id: newResearchId(), url: '', notes: '' }])}>
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
                    <FormField label={'Source URL ' + (index + 1)} htmlFor={'research-url-' + link.id}>
                      <input className={styles.workflowInput} id={'research-url-' + link.id} type="url" maxLength={2048} placeholder="https://example.com/article" value={link.url} onChange={(event) => updateResearchLink(link.id, 'url', event.target.value)} />
                    </FormField>
                    <FormField label="Focus note (optional)" htmlFor={'research-note-' + link.id} hint="Up to 500 characters.">
                      <textarea className={styles.workflowTextarea} id={'research-note-' + link.id} rows={2} maxLength={500} placeholder="What should the article take from this source?" value={link.notes} onChange={(event) => updateResearchLink(link.id, 'notes', event.target.value)} />
                    </FormField>
                  </div>
                  <button type="button" className={styles.removeAction} aria-label={'Remove research link ' + (index + 1)} onClick={() => setResearchLinks((current) => current.filter((item) => item.id !== link.id))}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className={styles.fullWidthGroup} aria-label="Visual references">
          <div className={styles.sectionHeadingRow}>
            <div>
              <h3 className={styles.workflowSectionTitle}>Visual reference files</h3>
              <p className={styles.sectionHint}>Attach up to four images or videos to give the AI visual context. Video audio is not analyzed; up to three frames are sampled from each video.</p>
            </div>
            <button type="button" className={styles.secondaryAction} disabled={isPreparingMedia || mediaReferences.length >= 4} onClick={() => fileInputRef.current?.click()}>
              {isPreparingMedia ? 'Preparing…' : '+ Add files'}
            </button>
          </div>
          <input ref={fileInputRef} className={styles.fileInput} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.webm,image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm" aria-label="Choose image or video reference files" onChange={handleFilesChange} />
          {mediaReferences.length === 0 ? (
            <p className={styles.emptyState}>No visual references attached. Supported formats: JPG, PNG, WebP, GIF, MP4, MOV, and WebM.</p>
          ) : (
            <div className={styles.mediaList}>
              {mediaReferences.map((reference) => (
                <div className={styles.mediaCard} key={reference.id}>
                  <img className={styles.mediaThumbnail} src={reference.frames[0]?.dataUrl ?? ''} alt={reference.name + ' preview'} />
                  <div className={styles.mediaDetails}>
                    <strong className={styles.mediaName}>{reference.name}</strong>
                    <small className={styles.sectionHint}>
                      {reference.kind === 'video' ? 'Video · ' + reference.frames.length + ' sampled frames' : 'Image reference'}
                      {' · ' + Math.round(reference.originalBytes / 1024) + ' KB'}
                    </small>
                    <textarea className={styles.workflowTextarea} rows={2} maxLength={500} aria-label={'Context for ' + reference.name} placeholder="Optional visual context for the AI" value={reference.notes} onChange={(event) => onMediaNoteChange(reference.id, event.target.value)} />
                  </div>
                  <button type="button" className={styles.removeAction} aria-label={'Remove ' + reference.name} onClick={() => onRemoveMedia(reference.id)}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </section>

        <ActionButton type="submit" disabled={isGenerating || isPreparingMedia}>
          {isGenerating ? 'Generating…' : 'Generate article'}
        </ActionButton>
      </form>

      <aside className={styles.workflowTips}>
        <h3 className={styles.workflowSectionTitle}>Workflow tips</h3>
        <ul>
          <li>Use source notes to identify the exact facts or angle you want emphasized.</li>
          <li>AI-generated citations link only to the research URLs supplied here.</li>
          <li>Visual references provide context; image and video files are not automatically added to the saved post.</li>
          <li>Generating an article does not create a Wix Blog post. You decide when to save an unpublished draft.</li>
        </ul>
      </aside>
    </div>
  );
}
