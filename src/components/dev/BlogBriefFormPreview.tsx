import { useState } from 'react';
import type { BlogBriefInput } from '../../lib/hooks/useBlogWorkflow';
import { useVisualReferences } from '../../lib/hooks/useVisualReferences';
import { BlogBriefForm } from '../blog/BlogBriefForm';
import { StatusPanel } from '../ui/StatusPanel';

export default function BlogBriefFormPreview() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const visualReferences = useVisualReferences((statusMessage) => {
    setMessage(statusMessage);
  });

  const handleGenerate = async (brief: BlogBriefInput) => {
    setIsGenerating(true);
    setMessage('');
    await Promise.resolve();
    setMessage('Preview received: ' + brief.topic + '. No AI request was sent.');
    setIsGenerating(false);
  };

  return (
    <main style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gap: 16 }}>
      <header>
        <h1 style={{ margin: '0 0 8px', color: '#172033' }}>Blog brief form preview</h1>
        <p style={{ margin: 0, color: '#5c6472' }}>Edit the form independently. Submitting only displays a local preview message.</p>
      </header>
      {message ? <StatusPanel title="Local preview" message={message} tone="success" /> : null}
      <BlogBriefForm
        isGenerating={isGenerating}
        isPreparingMedia={visualReferences.isPreparingMedia}
        mediaReferences={visualReferences.mediaReferences}
        onAddMediaFiles={visualReferences.addFiles}
        onMediaNoteChange={visualReferences.updateNote}
        onRemoveMedia={visualReferences.removeReference}
        onGenerate={handleGenerate}
      />
    </main>
  );
}
