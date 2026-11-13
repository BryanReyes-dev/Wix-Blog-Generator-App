import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { articleToEditableBody, type GeneratedArticle } from '../../lib/blog-content';
import type { ResearchSource } from '../../lib/media-reference-types';
import { ActionButton } from '../ui/ActionButton';
import { FormField } from '../ui/FormField';
import styles from './BlogWorkflow.module.css';

type ArticleReviewEditorProps = {
  article: GeneratedArticle;
  sources: ResearchSource[];
  isSaving: boolean;
  draftSaved: boolean;
  onSave: (draft: { title: string; body: string }) => Promise<void>;
};

function renderCitations(value: string, sources: ResearchSource[]): ReactNode[] {
  const sourceById = new Map(sources.map((source) => [source.id, source] as const));
  const parts: ReactNode[] = [];
  const pattern = /\[S\d+\]/g;
  let cursor = 0;

  for (const match of value.matchAll(pattern)) {
    const token = match[0];
    const index = match.index;
    if (index > cursor) parts.push(value.slice(cursor, index));
    const sourceId = token.slice(1, -1);
    const source = sourceById.get(sourceId);
    parts.push(source
      ? <a key={sourceId + '-' + index} className={styles.citationLink} href={source.url} target="_blank" rel="noreferrer" title={source.title}>{token}</a>
      : token);
    cursor = index + token.length;
  }

  if (cursor < value.length) parts.push(value.slice(cursor));
  return parts;
}

function renderPreviewBody(body: string, sources: ResearchSource[]) {
  const blocks = body.split(/\n{2,}/).map((value) => value.trim()).filter(Boolean);

  return blocks.map((block, index) => {
    const heading = /^(#{1,6})\s+(.+)$/.exec(block);
    if (heading) {
      return <h3 className={styles.previewHeading} key={'heading-' + index}>{renderCitations(heading[2] ?? '', sources)}</h3>;
    }

    if (block.startsWith('- ')) {
      const items = block.split('\n').map((line) => line.replace(/^[-*]\s+/, '').trim()).filter(Boolean);
      return <ul className={styles.previewList} key={'list-' + index}>{items.map((item, itemIndex) => <li key={itemIndex}>{renderCitations(item, sources)}</li>)}</ul>;
    }

    return <p className={styles.previewParagraph} key={'paragraph-' + index}>{renderCitations(block, sources)}</p>;
  });
}

export function ArticleReviewEditor({
  article,
  sources,
  isSaving,
  draftSaved,
  onSave,
}: ArticleReviewEditorProps) {
  const [title, setTitle] = useState(article.title);
  const [body, setBody] = useState(articleToEditableBody(article));

  useEffect(() => {
    setTitle(article.title);
    setBody(articleToEditableBody(article));
  }, [article]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSave({ title, body });
  };

  return (
    <section className={styles.reviewSection} aria-label="Review generated article">
      <div>
        <h3 className={styles.workflowSectionTitle}>Review and edit</h3>
        <p className={styles.workflowIntro}>
          Edit the article on the left and check the visitor preview on the right. Nothing is saved until you choose “Create unpublished draft.”
        </p>
      </div>

      <div className={styles.editorLayout}>
        <form className={styles.workflowForm} onSubmit={handleSubmit}>
          <FormField label="Title" htmlFor="draft-title" required>
            <input className={styles.workflowInput} id="draft-title" name="title" type="text" maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} required />
          </FormField>

          <FormField label="Article content" htmlFor="draft-body" required hint={'Edit text and headings before saving. Use "## Heading" for section headings.'}>
            <textarea className={styles.workflowTextarea} id="draft-body" name="body" rows={22} maxLength={30000} value={body} onChange={(event) => setBody(event.target.value)} required />
          </FormField>

          <ActionButton type="submit" disabled={isSaving || draftSaved}>
            {isSaving ? 'Saving draft…' : draftSaved ? 'Draft saved' : 'Create unpublished draft'}
          </ActionButton>
        </form>

        <div className={styles.previewCard} aria-label="Visitor article preview">
          <div className={styles.previewHeader}>
            <div>
              <strong>Visitor preview</strong>
              <p>Live preview of your editable article content</p>
            </div>
            <span>Preview</span>
          </div>
          <article className={styles.previewArticle}>
            <h2>{title || 'Your article title'}</h2>
            <p className={styles.previewDescription}>{article.metaDescription}</p>
            <div className={styles.previewBody}>{renderPreviewBody(body, sources)}</div>
          </article>
        </div>
      </div>

      {sources.length > 0 ? (
        <div className={styles.metadataCard}>
          <strong>Research sources</strong>
          <p className={styles.sourceIntro}>Citations in the article point to these retrieved public pages.</p>
          <ol className={styles.sourceList}>
            {sources.map((source) => (
              <li key={source.id}>
                <a href={source.url} target="_blank" rel="noreferrer">{'[' + source.id + '] ' + source.title}</a>
                <span>{source.publisher}</span>
                {source.excerpt ? <p>{source.excerpt}</p> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className={styles.metadataCard}>
        <strong>Suggested meta description</strong>
        <p>{article.metaDescription}</p>
      </div>

      <div className={styles.metadataCard}>
        <strong>Suggested SEO keywords</strong>
        <ul className={styles.keywordList}>
          {article.seoKeywords.map((keyword) => <li key={keyword}>{keyword}</li>)}
        </ul>
      </div>
    </section>
  );
}
