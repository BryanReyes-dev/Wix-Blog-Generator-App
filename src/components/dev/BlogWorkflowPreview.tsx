import { BlogWorkflow } from '../blog/BlogWorkflow';

export default function BlogWorkflowPreview() {
  // Authentication is intentionally disabled in this isolated preview.
  const handleSignOut = async (): Promise<void> => {
    console.info('Sign-out is disabled in the isolated workflow preview.');
  };

  return <BlogWorkflow mode="mock" onSignOut={handleSignOut} />;
}
