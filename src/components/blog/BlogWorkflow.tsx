import { useState } from 'react';
import { useBlogWorkflow, type BlogBriefInput } from '../../lib/hooks/useBlogWorkflow';
import { useVisualReferences } from '../../lib/hooks/useVisualReferences';
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
    sources,
    uploadedMedia,
    removeUploadedMedia,
    notice,
    isGenerating,
    isSaving,
    draftSaved,
    generateArticle,
    createDraft,
  } = useBlogWorkflow({ mode });
  const [signOutError, setSignOutError] = useState('');
  const [mediaNotice, setMediaNotice] = useState<{
    message: string;
    tone: 'info' | 'error' | 'success';
  } | null>(null);

  const visualReferences = useVisualReferences((message, tone = 'info') => {
    setMediaNotice({ message, tone });
  });

  const handleSignOut = async () => {
    setSignOutError('');
    try {
      await onSignOut();
    } catch {
      setSignOutError('Sign-out could not be completed. Please try again.');
    }
  };

  const handleGenerate = async (brief: BlogBriefInput) => {
    setMediaNotice(null);
    await generateArticle(brief);
  };

  const visibleNotice = mediaNotice ?? notice;

  return (
    <main className={styles.root}>
      <header className={styles.workflowTopBar}>
        <div>
          <h2 className={styles.title}>Create a Wix Blog draft</h2>
          <p className={styles.workflowIntro}>
            Describe the article, add research and original media, review the editorial layout, then save an unpublished draft when it is ready.
          </p>
        </div>
        <ActionButton variant="secondary" onClick={() => void handleSignOut()}>
          Sign out
        </ActionButton>
      </header>

      {mode === 'mock' ? (
        <StatusPanel
          title="Development mock mode"
          message="Generation and draft saving are simulated. Live web research and image/video analysis are disabled, and no Wix Blog draft is created."
          tone="info"
        />
      ) : null}

      {signOutError ? (
        <StatusPanel title="Sign-out failed" message={signOutError} tone="error" />
      ) : null}

      {visibleNotice ? (
        <StatusPanel title="Workflow status" message={visibleNotice.message} tone={visibleNotice.tone} />
      ) : null}

      <BlogBriefForm
        isGenerating={isGenerating}
        isPreparingMedia={visualReferences.isPreparingMedia}
        mediaReferences={visualReferences.mediaReferences}
        onAddMediaFiles={visualReferences.addFiles}
        onMediaNoteChange={visualReferences.updateNote}
        onRemoveMedia={(id) => {
          visualReferences.removeReference(id);
          removeUploadedMedia(id);
        }}
        onGenerate={handleGenerate}
      />

      {article ? (
        <ArticleReviewEditor
          article={article}
          sources={sources}
          media={uploadedMedia}
          isSaving={isSaving}
          draftSaved={draftSaved}
          onSave={createDraft}
        />
      ) : null}
    </main>
  );
}
