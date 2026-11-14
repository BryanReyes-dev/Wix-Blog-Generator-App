import { useState } from 'react';
import { BlogWorkflow } from '../blog/BlogWorkflow';
import { ActionButton } from '../ui/ActionButton';
import { StatusPanel } from '../ui/StatusPanel';

type PreviewScreen = 'login' | 'workflow' | 'permission-denied' | 'unavailable';

export default function DevMemberAccessPreview() {
  const [screen, setScreen] = useState<PreviewScreen>('login');

  const openLogin = () => setScreen('login');
  const openWorkflow = () => setScreen('workflow');
  const openDenied = () => setScreen('permission-denied');
  const openUnavailable = () => setScreen('unavailable');

  const handleMockSignOut = async () => {
    setScreen('login');
  };

  return (
    <main style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gap: 16 }}>
      <header style={{ display: 'grid', gap: 8 }}>
        <p style={{ margin: 0, color: '#526078', fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Development UI preview
        </p>
        <h1 style={{ margin: 0, color: '#172033', fontSize: 26 }}>Member access flow</h1>
        <p style={{ margin: 0, color: '#5c6472', lineHeight: 1.6 }}>
          Switch between the member states without signing in to Wix. The workflow uses mock generation and mock draft saving.
        </p>
      </header>

      <nav aria-label="Preview screens" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <ActionButton variant={screen === 'login' ? 'primary' : 'secondary'} onClick={openLogin}>Login</ActionButton>
        <ActionButton variant={screen === 'workflow' ? 'primary' : 'secondary'} onClick={openWorkflow}>Approved workflow</ActionButton>
        <ActionButton variant={screen === 'permission-denied' ? 'primary' : 'secondary'} onClick={openDenied}>Permission denied</ActionButton>
        <ActionButton variant={screen === 'unavailable' ? 'primary' : 'secondary'} onClick={openUnavailable}>Access unavailable</ActionButton>
      </nav>

      {screen === 'login' ? (
        <StatusPanel
          title="Intern sign-in"
          message="You are not signed in. Use the mock sign-in button to simulate an approved Wix member."
        >
          <ActionButton onClick={openWorkflow}>Sign in with Wix (mock)</ActionButton>
          <ActionButton variant="secondary" onClick={openDenied}>Preview denied member</ActionButton>
          <ActionButton variant="secondary" onClick={openUnavailable}>Preview unavailable access</ActionButton>
        </StatusPanel>
      ) : null}

      {screen === 'workflow' ? (
        <BlogWorkflow mode="mock" onSignOut={handleMockSignOut} />
      ) : null}

      {screen === 'permission-denied' ? (
        <StatusPanel
          title="Permission denied"
          message="This simulated member is signed in, but the site team has not approved the account for the blog-generation workflow."
          tone="error"
        >
          <ActionButton onClick={openLogin}>Sign out</ActionButton>
          <ActionButton variant="secondary" onClick={openWorkflow}>Preview approved workflow</ActionButton>
        </StatusPanel>
      ) : null}

      {screen === 'unavailable' ? (
        <StatusPanel
          title="Unable to verify access"
          message="This simulates a failed member-session or approval lookup. Access remains blocked until verification succeeds."
          tone="error"
        >
          <ActionButton variant="secondary" onClick={openLogin}>Retry / return to login</ActionButton>
          <ActionButton onClick={openWorkflow}>Simulate verified approval</ActionButton>
        </StatusPanel>
      ) : null}
    </main>
  );
}
