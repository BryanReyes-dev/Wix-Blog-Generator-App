import { useCallback, useEffect, useState } from 'react';
import {
  useSiteMemberAccess,
  type SiteMemberAccess,
} from '../../lib/hooks/useSiteMemberAccess';
import { ActionButton } from '../ui/ActionButton';
import { StatusPanel } from '../ui/StatusPanel';
import { BlogWorkflow } from '../blog/BlogWorkflow';
import styles from './MemberAccessWidget.module.css';

const ROUTES = {
  login: '/admin',
  workflow: '/admin/workflow',
  permissionDenied: '/admin/permission-denied',
} as const;

function isManagedRoute(path: string): boolean {
  return Object.values(ROUTES).some((route) => route === path);
}

export function MemberAccessWidget() {
  const {
    getCurrentPath,
    checkAccess,
    signIn,
    signOut,
    navigateTo,
  } = useSiteMemberAccess();

  const [route, setRoute] = useState<string | null>(null);
  const [access, setAccess] = useState<SiteMemberAccess | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [routeLoadFailed, setRouteLoadFailed] = useState(false);
  const [actionError, setActionError] = useState('');

  const initialize = useCallback(async () => {
    setIsInitializing(true);
    setRouteLoadFailed(false);
    setActionError('');

    try {
      const currentPath = await getCurrentPath();
      setRoute(currentPath);

      if (isManagedRoute(currentPath)) {
        setAccess(await checkAccess());
      } else {
        setAccess(null);
      }
    } catch {
      setRouteLoadFailed(true);
    } finally {
      setIsInitializing(false);
    }
  }, [checkAccess, getCurrentPath]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (!route || !access || access.state === 'unavailable') return;

    if (route === ROUTES.login) {
      if (access.state === 'approved') navigateTo(ROUTES.workflow);
      if (access.state === 'denied') navigateTo(ROUTES.permissionDenied);
      return;
    }

    if (route === ROUTES.workflow) {
      if (access.state === 'signed-out') navigateTo(ROUTES.login);
      if (access.state === 'denied') navigateTo(ROUTES.permissionDenied);
      return;
    }

    if (route === ROUTES.permissionDenied) {
      if (access.state === 'signed-out') navigateTo(ROUTES.login);
      if (access.state === 'approved') navigateTo(ROUTES.workflow);
    }
  }, [access, navigateTo, route]);

  const retryAccessCheck = async () => {
    setIsBusy(true);
    setActionError('');
    try {
      setAccess(await checkAccess());
    } finally {
      setIsBusy(false);
    }
  };

  const handleSignIn = async () => {
    setIsBusy(true);
    setActionError('');
    try {
      await signIn();
      setAccess(await checkAccess());
    } catch {
      setActionError('Sign-in was canceled or could not be completed.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSignOut = async () => {
    setIsBusy(true);
    setActionError('');
    try {
      await signOut();
      navigateTo(ROUTES.login);
    } catch {
      setActionError('Sign-out could not be completed. Please try again.');
      throw new Error('Wix member sign-out failed.');
    } finally {
      setIsBusy(false);
    }
  };

  if (isInitializing) {
    return (
      <div className={styles.root}>
        <StatusPanel
          title="Checking member access"
          message="Checking your Wix member session and workflow approval…"
        />
      </div>
    );
  }

  if (routeLoadFailed) {
    return (
      <div className={styles.root}>
        <StatusPanel
          title="Authentication routing unavailable"
          message="Open the published development site to check member authentication and page navigation."
          tone="error"
        >
          <ActionButton variant="secondary" onClick={() => void initialize()} disabled={isBusy}>
            Retry
          </ActionButton>
        </StatusPanel>
      </div>
    );
  }

  if (!route || !isManagedRoute(route)) {
    return (
      <div className={styles.root}>
        <StatusPanel
          title="Widget placed on the wrong page"
          message="Place this widget on /admin, /admin/workflow, or /admin/permission-denied."
          tone="error"
        />
      </div>
    );
  }

  if (!access) {
    return (
      <div className={styles.root}>
        <StatusPanel title="Checking workflow access" message="Verifying your Wix member session…" />
      </div>
    );
  }

  if (route === ROUTES.workflow && access.state === 'approved') {
    return <BlogWorkflow onSignOut={handleSignOut} />;
  }

  if (route === ROUTES.login && access.state === 'signed-out') {
    return (
      <div className={styles.root}>
        <StatusPanel
          title="Intern sign-in"
          message={actionError || 'You are not signed in. Sign in with your Wix member account to check workflow access.'}
        >
          <ActionButton onClick={() => void handleSignIn()} disabled={isBusy}>
            {isBusy ? 'Opening Wix login…' : 'Sign in with Wix'}
          </ActionButton>
          <ActionButton variant="secondary" onClick={() => void retryAccessCheck()} disabled={isBusy}>
            Retry access check
          </ActionButton>
        </StatusPanel>
      </div>
    );
  }

  if (access.state === 'unavailable') {
    return (
      <div className={styles.root}>
        <StatusPanel
          title="Unable to verify access"
          message={actionError || (
            access.memberExists
              ? 'You are signed in, but approval could not be verified. Access remains blocked; retry or sign out.'
              : 'Your member session or approval could not be verified. Retry the check or sign in again.'
          )}
          tone="error"
        >
          <ActionButton variant="secondary" onClick={() => void retryAccessCheck()} disabled={isBusy}>
            Retry access check
          </ActionButton>
          {access.memberExists ? (
            <ActionButton onClick={() => void handleSignOut().catch(() => undefined)} disabled={isBusy}>
              Sign out
            </ActionButton>
          ) : (
            <ActionButton onClick={() => void handleSignIn()} disabled={isBusy}>
              Sign in with Wix
            </ActionButton>
          )}
        </StatusPanel>
      </div>
    );
  }

  if (route === ROUTES.permissionDenied && access.state === 'denied') {
    return (
      <div className={styles.root}>
        <StatusPanel
          title="Permission denied"
          message="You are signed in, but the site team has not approved your account for the blog-generation workflow. Contact the site administrator if you believe this is a mistake."
          tone="error"
        >
          <ActionButton onClick={() => void handleSignOut().catch(() => undefined)} disabled={isBusy}>
            Sign out
          </ActionButton>
        </StatusPanel>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <StatusPanel
        title="Redirecting"
        message="Your Wix member access has been checked. Opening the appropriate page…"
      />
    </div>
  );
}
