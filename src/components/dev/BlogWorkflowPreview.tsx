import { BlogWorkflow } from '../blog/BlogWorkflow';
import styles from '../blog/BlogWorkflow.module.css';

export default function BlogWorkflowPreview() {
  // Authentication is intentionally disabled in this isolated preview.
  const handleSignOut = async (): Promise<void> => {
    console.info('Sign-out is disabled in the isolated workflow preview.');
  };

  // Give the preview the same width-based responsive context as the Wix widget.
  return (
    <div className={styles.widgetContainer}>
      <BlogWorkflow mode="mock" onSignOut={handleSignOut} />
    </div>
  );
}
