import { useEffect, useState, type FormEvent } from 'react';
import { articleToEditableBody, type GeneratedArticle } from '../../lib/blog-content';
import { ActionButton } from '../ui/ActionButton';
import { FormField } from '../ui/FormField';
import styles from './BlogWorkflow.module.css';

type ArticleReviewEditorProps = {
  article: GeneratedArticle;
  isSaving: boolean;
  draftSaved: boolean;
  onSave: (draft: { title: string; body: string }) => Promise<void>;
};

export function ArticleReviewEditor({
  article,
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
          Nothing is saved to Wix Blog until you choose “Create unpublished draft.”
        </p>
      </div>

      <form className={styles.workflowForm} onSubmit={handleSubmit}>
        <FormField label="Title" htmlFor="draft-title" required>
          <input
            className={styles.workflowInput}
            id="draft-title"
            name="title"
            type="text"
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </FormField>

        <FormField
          label="Article content"
          htmlFor="draft-body"
          required
          hint={'Edit the text and headings before saving. Use "## Heading" for section headings.'}
        >
          <textarea
            className={styles.workflowTextarea}
            id="draft-body"
            name="body"
            rows={18}
            maxLength={30000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            required
          />
        </FormField>

        <ActionButton type="submit" disabled={isSaving || draftSaved}>
          {isSaving ? 'Saving draft…' : draftSaved ? 'Draft saved' : 'Create unpublished draft'}
        </ActionButton>
      </form>

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
