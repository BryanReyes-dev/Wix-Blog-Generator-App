import { httpClient } from "@wix/essentials";
import type { Credits, MemberPage, WixBlogStatus } from "../types";

const API_BASE_URL = new URL(import.meta.url).origin;
const PAGE_SIZE = 20;

export async function readApiError(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { error?: string };
    if (payload.error) return payload.error;
  } catch {
    // The response may not contain JSON.
  }

  return "The request failed. Check app permissions and site setup.";
}

export async function fetchCredits(): Promise<Credits> {
  const response = await httpClient.fetchWithAuth(API_BASE_URL + "/api/admin/credits");
  if (!response.ok) throw new Error(await readApiError(response));
  return await response.json() as Credits;
}

export async function fetchWixBlogStatus(): Promise<WixBlogStatus> {
  const response = await httpClient.fetchWithAuth(API_BASE_URL + "/api/admin/blog-status");
  if (!response.ok) throw new Error(await readApiError(response));
  return await response.json() as WixBlogStatus;
}

export async function fetchMembers(offset: number, searchTerm: string): Promise<MemberPage> {
  const url = new URL(API_BASE_URL + "/api/admin/members");
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("offset", String(offset));
  if (searchTerm) url.searchParams.set("search", searchTerm);

  const response = await httpClient.fetchWithAuth(url.toString());
  if (!response.ok) throw new Error(await readApiError(response));
  return await response.json() as MemberPage;
}

export async function updateMemberAccess(memberId: string, enabled: boolean): Promise<void> {
  const response = await httpClient.fetchWithAuth(API_BASE_URL + "/api/admin/workflow-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberId, enabled }),
  });

  if (!response.ok) throw new Error(await readApiError(response));
}
