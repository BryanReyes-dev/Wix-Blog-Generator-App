import type { FormEvent } from 'react';
import type { BlogBriefInput } from '../../lib/hooks/useBlogWorkflow';
import { ActionButton } from '../ui/ActionButton';
import { FormField } from '../ui/FormField';
import styles from './BlogWorkflow.module.css';

type BlogBriefFormProps = {
  isGenerating: boolean;
  onGenerate: (brief: BlogBriefInput) => Promise<void>;
};

export function BlogBriefForm({ isGenerating, onGenerate }: BlogBriefFormProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    void onGenerate({
      topic: String(formData.get('topic') ?? ''),
      audience: String(formData.get('audience') ?? ''),
      tone: String(formData.get('tone') ?? ''),
      instructions: String(formData.get('instructions') ?? ''),
      seoKeywords: String(formData.get('seoKeywords') ?? ''),
    });
  };

  return (
    <form className={styles.workflowForm} onSubmit={handleSubmit}>
      <FormField label="Topic or working title" htmlFor="blog-topic" required>
        <input
          className={styles.workflowInput}
          id="blog-topic"
          name="topic"
          type="text"
          maxLength={200}
          placeholder="Topic or working title"
          required
        />
      </FormField>

      <FormField label="Target audience" htmlFor="blog-audience" required>
        <input
          className={styles.workflowInput}
          id="blog-audience"
          name="audience"
          type="text"
          maxLength={300}
          placeholder="Who should this article help?"
          required
        />
      </FormField>

      <FormField label="Writing tone" htmlFor="blog-tone" required>
        <input
          className={styles.workflowInput}
          id="blog-tone"
          name="tone"
          type="text"
          maxLength={120}
          placeholder="For example: warm, practical, and confident"
          required
        />
      </FormField>

      <FormField label="Main points or instructions" htmlFor="blog-instructions" required>
        <textarea
          className={styles.workflowTextarea}
          id="blog-instructions"
          name="instructions"
          rows={5}
          maxLength={3000}
          placeholder="Include the points, examples, or instructions the article should cover."
          required
        />
      </FormField>

      <FormField
        label="Optional SEO keywords"
        htmlFor="blog-keywords"
        hint="Separate keywords with commas. Up to five suggested keywords."
      >
        <input
          className={styles.workflowInput}
          id="blog-keywords"
          name="seoKeywords"
          type="text"
          maxLength={400}
          placeholder="Separate keywords with commas"
        />
      </FormField>

      <ActionButton type="submit" disabled={isGenerating}>
        {isGenerating ? 'Generating…' : 'Generate article'}
      </ActionButton>
    </form>
  );
}
