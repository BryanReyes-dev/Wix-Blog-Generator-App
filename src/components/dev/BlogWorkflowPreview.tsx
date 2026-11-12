import { BlogWorkflow } from '../blog/BlogWorkflow';

export default function BlogWorkflowPreview() {
  // Authentication is intentionally disabled in this UI preview.
  const handleSignOut = async (): Promise<void> => {
    console.info('Sign-out is disabled in the standalone preview.');
  };

  return <BlogWorkflow onSignOut={handleSignOut} />;
}