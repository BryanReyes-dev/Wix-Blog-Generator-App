import { useCallback } from 'react';
import { httpClient } from '@wix/essentials';
import { location } from '@wix/site-location';
import { authentication, currentMember } from '@wix/site-members';

const API_BASE_URL = new URL(import.meta.url).origin;

export type SiteMemberAccess =
  | { state: 'signed-out'; memberExists: false }
  | { state: 'approved' | 'denied'; memberExists: true }
  | { state: 'unavailable'; memberExists: boolean };

export function useSiteMemberAccess() {
  const getCurrentPath = useCallback(async (): Promise<string> => {
    const segments = await location.path();
    return '/' + segments.map((segment) => segment.trim()).filter(Boolean).join('/');
  }, []);

  const checkAccess = useCallback(async (): Promise<SiteMemberAccess> => {
    let member: Awaited<ReturnType<typeof currentMember.getMember>>;

    try {
      member = await currentMember.getMember();
    } catch {
      return { state: 'unavailable', memberExists: false };
    }

    if (!member) return { state: 'signed-out', memberExists: false };

    try {
      const response = await httpClient.fetchWithAuth(API_BASE_URL + '/api/workflow-access');
      if (!response.ok) return { state: 'unavailable', memberExists: true };

      const result: unknown = await response.json();
      if (
        !result ||
        typeof result !== 'object' ||
        !('authorized' in result) ||
        typeof result.authorized !== 'boolean'
      ) {
        return { state: 'unavailable', memberExists: true };
      }

      return result.authorized
        ? { state: 'approved', memberExists: true }
        : { state: 'denied', memberExists: true };
    } catch {
      return { state: 'unavailable', memberExists: true };
    }
  }, []);

  const signIn = useCallback(async (): Promise<void> => {
    await authentication.promptLogin({ mode: 'login', modal: true });
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    await authentication.logout();
  }, []);

  const navigateTo = useCallback((path: string): void => {
    location.to(path);
  }, []);

  return {
    getCurrentPath,
    checkAccess,
    signIn,
    signOut,
    navigateTo,
  };
}
