import { httpClient } from "@wix/essentials";
import type { ApiError } from "../types";

const API_BASE_URL = new URL(import.meta.url).origin;

export async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const response = await httpClient.fetchWithAuth(API_BASE_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "The request failed. Check your permissions and site setup.";

    try {
      const result = await response.json() as ApiError;
      if (typeof result.error === "string") message = result.error;
    } catch {
      // Keep the safe fallback for non-JSON error responses.
    }

    throw new Error(message);
  }

  return await response.json() as T;
}
