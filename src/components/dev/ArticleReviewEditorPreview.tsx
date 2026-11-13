import { useState } from 'react';
import { MOCK_GENERATED_ARTICLE } from '../../lib/dev/mock-blog-workflow';
import { ArticleReviewEditor } from '../blog/ArticleReviewEditor';
import { StatusPanel } from '../ui/StatusPanel';

export default function ArticleReviewEditorPreview() {
  const [isSaving, setIsSaving] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  const handleMockSave = async (draft: { title: string; body: string }) => {
    setIsSaving(true);
    await Promise.resolve();
    setDraftSaved(true);
    setIsSaving(false);
    console.info('Mock draft saved locally:', draft.title, draft.body.length);
  };

  return (
    <main style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gap: 16 }}>
      <header>
        <h1 style={{ margin: '0 0 8px', color: '#172033' }}>Article review preview</h1>
        <p style={{ margin: 0, color: '#5c6472' }}>Edit the sample article and simulate saving without contacting Wix.</p>
      </header>
      {draftSaved ? (
        <StatusPanel
          title="Mock draft saved"
          message="The preview recorded a simulated save. Nothing was sent to Wix Blog."
          tone="success"
        />
      ) : null}
      <ArticleReviewEditor
        article={MOCK_GENERATED_ARTICLE}
        sources={[]}
        isSaving={isSaving}
        draftSaved={draftSaved}
        onSave={handleMockSave}
      />
    </main>
  );
}
