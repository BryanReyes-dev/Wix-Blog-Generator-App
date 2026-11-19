import { apiFetch } from "../../../../../lib/client/api";
import type { ApiError, ResearchLinkCheck } from "../types";

export class WorkflowApiError extends Error {
  readonly researchLinkResults: ResearchLinkCheck[];

  constructor(message: string, researchLinkResults: ResearchLinkCheck[] = []) {
    super(message);
    this.name = "WorkflowApiError";
    this.researchLinkResults = researchLinkResults;
  }
}

function isResearchLinkCheck(value: unknown): value is ResearchLinkCheck {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.id === "string" &&
    typeof result.url === "string" &&
    (result.status === "success" || result.status === "error") &&
    (result.title === undefined || typeof result.title === "string") &&
    (result.message === undefined || typeof result.message === "string")
  );
}

export async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const response = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "The request failed. Check your permissions and site setup.";
    let researchLinkResults: ResearchLinkCheck[] = [];

    try {
      const result = await response.json() as ApiError & { researchLinkResults?: unknown };
      if (typeof result.error === "string") message = result.error;
      if (Array.isArray(result.researchLinkResults)) {
        researchLinkResults = result.researchLinkResults.filter(isResearchLinkCheck);
      }
    } catch {
      // Keep the safe fallback for non-JSON error responses.
    }

    throw new WorkflowApiError(message, researchLinkResults);
  }

  return await response.json() as T;
}
