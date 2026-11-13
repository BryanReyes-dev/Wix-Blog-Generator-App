import { useState } from 'react';
import { useBlogWorkflow } from '../../lib/hooks/useBlogWorkflow';
import { ActionButton } from '../ui/ActionButton';
import { StatusPanel } from '../ui/StatusPanel';
import { ArticleReviewEditor } from './ArticleReviewEditor';
import { BlogBriefForm } from './BlogBriefForm';
import styles from './BlogWorkflow.module.css';

type BlogWorkflowProps = {
  onSignOut: () => Promise<void>;
  mode?: 'live' | 'mock';
};

export function BlogWorkflow({ onSignOut, mode = 'live' }: BlogWorkflowProps) {
  const {
    article,
    notice,
    isGenerating,
    isSaving,
    draftSaved,
    generateArticle,
    createDraft,
  } = useBlogWorkflow({ mode });
  const [signOutError, setSignOutError] = useState('');

  const handleSignOut = async () => {
    setSignOutError('');
    try {
      await onSignOut();
    } catch {
      setSignOutError('Sign-out could not be completed. Please try again.');
    }
  };

  return (
    <main className={styles.root}>
      <header className={styles.workflowTopBar}>
        <div>
          <h2 className={styles.title}>Create a Wix Blog draft</h2>
          <p className={styles.workflowIntro}>
            Describe the article, review and edit the generated content, then choose when to save it as an unpublished draft.
          </p>
        </div>
        <ActionButton variant="secondary" onClick={() => void handleSignOut()}>
          Sign out
        </ActionButton>
      </header>

      {mode === 'mock' ? (
        <StatusPanel
          title="Development mock mode"
          message="Generation and draft saving are simulated. No Wix AI request is sent and no Wix Blog draft is created."
          tone="info"
        />
      ) : null}

      {signOutError ? (
        <StatusPanel title="Sign-out failed" message={signOutError} tone="error" />
      ) : null}

      {notice ? (
        <StatusPanel title="Workflow status" message={notice.message} tone={notice.tone} />
      ) : null}

      <BlogBriefForm isGenerating={isGenerating} onGenerate={generateArticle} />

      {article ? (
        <ArticleReviewEditor
          article={article}
          isSaving={isSaving}
          draftSaved={draftSaved}
          onSave={createDraft}
        />
      ) : null}
    </main>
  );
}
