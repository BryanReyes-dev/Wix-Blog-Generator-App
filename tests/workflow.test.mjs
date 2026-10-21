import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ApiError,
  getActiveWixToken,
  requireApprovedMember,
  requirePrivilegedDashboardUser,
  requireWixSubject,
} from '../src/lib/server/authorization-core.ts';
import {
  articleToEditableBody,
  bodyToRichContent,
  InputValidationError,
  parseBlogBrief,
  parseDraftSubmission,
  parseGeneratedArticle,
} from '../src/lib/server/blog-content.ts';
import { createSubmissionGate } from '../src/lib/server/draft-submissions.ts';
import { AiProviderError, generateBlogArticle } from '../src/lib/server/generate-blog-article.ts';

const memberToken = (overrides = {}) => ({
  active: true,
  subjectType: 'MEMBER',
  subjectId: 'member-from-signed-wix-token',
  siteId: 'site-id',
  ...overrides,
});

const userToken = (overrides = {}) => ({
  active: true,
  subjectType: 'USER',
  subjectId: 'dashboard-user-id',
  siteId: 'site-id',
  ...overrides,
});

const validArticle = () => ({
  title: 'A Practical Guide to Better Sleep',
  introduction: 'Small habits can make bedtime more consistent.',
  sections: [
    { heading: 'Build a steady routine', body: 'Choose a regular time to wind down.' },
    { heading: 'Make the room comfortable', body: 'Reduce light and noise where possible.' },
  ],
  conclusion: 'Start with one change and keep it manageable.',
  metaDescription: 'Simple ways to build a calmer, more consistent sleep routine.',
  seoKeywords: ['sleep routine', 'better sleep'],
});

test('signed-out and expired Wix tokens are rejected', async () => {
  await assert.rejects(
    getActiveWixToken(async () => { throw new Error('no Wix token'); }),
    (error) => error instanceof ApiError && error.status === 401,
  );

  await assert.rejects(
    getActiveWixToken(async () => memberToken({ active: false })),
    (error) => error instanceof ApiError && error.status === 401,
  );
});

test('site member identity comes from the Wix token and unapproved members are denied', async () => {
  const token = await getActiveWixToken(async () => memberToken());
  const member = requireWixSubject(token, 'MEMBER');
  assert.equal(member.memberId, 'member-from-signed-wix-token');

  await assert.rejects(
    requireApprovedMember(token, async () => false),
    (error) => error instanceof ApiError && error.status === 403,
  );
});

test('approval service failures fail closed and approved members are accepted', async () => {
  const token = await getActiveWixToken(async () => memberToken());

  await assert.rejects(
    requireApprovedMember(token, async () => { throw new Error('collection unavailable'); }),
    (error) => error instanceof ApiError && error.status === 503,
  );

  const member = await requireApprovedMember(token, async (memberId) => {
    assert.equal(memberId, 'member-from-signed-wix-token');
    return true;
  });
  assert.equal(member.memberId, 'member-from-signed-wix-token');
});

test('site members cannot use administrator operations; Wix privileged access is required', async () => {
  const memberTokenInfo = await getActiveWixToken(async () => memberToken());
  let privilegeChecks = 0;

  await assert.rejects(
    requirePrivilegedDashboardUser(memberTokenInfo, async () => {
      privilegeChecks += 1;
      return true;
    }),
    (error) => error instanceof ApiError && error.status === 403,
  );
  assert.equal(privilegeChecks, 0);

  const userTokenInfo = await getActiveWixToken(async () => userToken());
  await assert.rejects(
    requirePrivilegedDashboardUser(userTokenInfo, async () => false),
    (error) => error instanceof ApiError && error.status === 403,
  );

  const administrator = await requirePrivilegedDashboardUser(userTokenInfo, async () => true);
  assert.equal(administrator.userId, 'dashboard-user-id');
});

test('brief validation requires all core fields and accepts optional SEO keywords', () => {
  assert.throws(() => parseBlogBrief({ topic: 'sleep' }), InputValidationError);

  const brief = parseBlogBrief({
    topic: 'Better sleep habits',
    audience: 'Adults with busy schedules',
    tone: 'Warm and practical',
    instructions: 'Cover evening routines and bedroom conditions.',
    seoKeywords: 'sleep routine, better sleep',
  });
  assert.deepEqual(brief.seoKeywords, ['sleep routine', 'better sleep']);
  assert.deepEqual(parseBlogBrief({
    topic: 'sleep', audience: 'adults', tone: 'friendly', instructions: 'Keep it simple.',
  }).seoKeywords, []);
});

test('generated article is server-validated and converted into an editable body', () => {
  const article = parseGeneratedArticle(validArticle());
  const body = articleToEditableBody(article);
  assert.match(body, /## Introduction/);
  assert.match(body, /## Build a steady routine/);
  assert.match(body, /## Conclusion/);

  assert.throws(() => parseGeneratedArticle({ ...validArticle(), sections: [] }), InputValidationError);
  assert.throws(() => parseGeneratedArticle({ ...validArticle(), title: 'x'.repeat(201) }), InputValidationError);
});

test('draft validation ignores client-supplied identity and builds Ricos headings and paragraphs', () => {
  const submission = parseDraftSubmission({
    submissionId: 'b30d6826-5de3-4ef6-8f4d-e7fa80c05357',
    memberId: 'forged-member-id',
    title: validArticle().title,
    body: '## Introduction\n\nFirst paragraph.\n\n## Conclusion\n\nLast paragraph.',
    metaDescription: validArticle().metaDescription,
    seoKeywords: validArticle().seoKeywords,
  });

  assert.equal('memberId' in submission, false);
  const richContent = bodyToRichContent(submission.body);
  assert.equal(richContent.nodes[0]?.type, 'HEADING');
  assert.equal(richContent.nodes[1]?.type, 'PARAGRAPH');
  assert.equal(richContent.nodes.some((node) => node.type === 'HEADING'), true);
});

test('same member submission ID shares an in-flight or successful draft result', async () => {
  const gate = createSubmissionGate(60_000);
  let calls = 0;
  const create = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { draftId: 'draft-123', status: 'UNPUBLISHED' };
  };

  const [first, duplicate] = await Promise.all([
    gate('member-1', 'submission-1', create, 0),
    gate('member-1', 'submission-1', create, 0),
  ]);
  assert.deepEqual(first, duplicate);
  assert.equal(calls, 1);

  await gate('member-2', 'submission-1', create, 0);
  assert.equal(calls, 2);
});

test('OpenAI Responses generation uses strict structured output and validates provider failures', async () => {
  let requestUrl = '';
  let requestBody = null;
  const fakeFetch = async (url, options) => {
    requestUrl = url;
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      output: [{
        type: 'message',
        content: [{ type: 'output_text', text: JSON.stringify(validArticle()) }],
      }],
    }), { status: 200 });
  };

  const result = await generateBlogArticle(
    { topic: 'sleep', audience: 'adults', tone: 'practical', instructions: 'Keep it useful.', seoKeywords: [] },
    { apiKey: 'test-key', model: 'gpt-5.4-mini', fetcher: fakeFetch },
  );

  assert.equal(requestUrl, 'https://api.openai.com/v1/responses');
  assert.equal(requestBody.model, 'gpt-5.4-mini');
  assert.equal(requestBody.text.format.type, 'json_schema');
  assert.equal(requestBody.text.format.strict, true);
  assert.deepEqual(result, validArticle());

  await assert.rejects(
    generateBlogArticle(
      { topic: 'sleep', audience: 'adults', tone: 'practical', instructions: 'Keep it useful.', seoKeywords: [] },
      { apiKey: '', model: 'gpt-5.4-mini', fetcher: fakeFetch },
    ),
    (error) => error instanceof AiProviderError && error.status === 503,
  );

  await assert.rejects(
    generateBlogArticle(
      { topic: 'sleep', audience: 'adults', tone: 'practical', instructions: 'Keep it useful.', seoKeywords: [] },
      { apiKey: 'test-key', model: 'gpt-5.4-mini', fetcher: async () => new Response('{', { status: 200 }) },
    ),
    (error) => error instanceof AiProviderError && error.status === 502,
  );
});
