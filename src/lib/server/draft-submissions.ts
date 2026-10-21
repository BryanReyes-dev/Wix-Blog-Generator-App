export type CreatedDraft = {
  draftId: string;
  status: 'UNPUBLISHED';
};

type CachedAttempt = {
  expiresAt: number;
  result: Promise<CreatedDraft>;
};

export function createSubmissionGate(retentionMs = 10 * 60 * 1000) {
  const attempts = new Map<string, CachedAttempt>();

  return async function run(
    memberId: string,
    submissionId: string,
    create: () => Promise<CreatedDraft>,
    now = Date.now(),
  ): Promise<CreatedDraft> {
    for (const [key, attempt] of attempts) {
      if (attempt.expiresAt <= now) attempts.delete(key);
    }

    const key = `${memberId}:${submissionId}`;
    const existing = attempts.get(key);
    if (existing && existing.expiresAt > now) return existing.result;

    const result = Promise.resolve().then(create);
    attempts.set(key, { expiresAt: now + retentionMs, result });

    try {
      return await result;
    } catch (error) {
      const current = attempts.get(key);
      if (current?.result === result) attempts.delete(key);
      throw error;
    }
  };
}

export const runDraftSubmission = createSubmissionGate();
