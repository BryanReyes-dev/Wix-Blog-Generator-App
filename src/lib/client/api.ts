import { httpClient } from '@wix/essentials';

const API_ORIGIN = new URL(import.meta.url).origin;

export function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = new URL(path, API_ORIGIN);

  return httpClient.fetchWithAuth(url.href, init);
}