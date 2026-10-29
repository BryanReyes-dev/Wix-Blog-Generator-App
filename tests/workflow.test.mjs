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
import { isWixBlogInstalled } from '../src/lib/server/wix-blog-installation.ts';
import { getAllowedDevCorsOrigins, isAllowedDevCorsOrigin } from '../src/lib/dev-cors.mjs';
import {
  assertCitationIntegrity,
  extractResearchPage,
  loadResearchSources,
  parseResearchCitationSources,
  parseResearchUrls,
  ResearchSourceError,
  validateResearchUrl,
} from '../src/lib/server/research-sources.ts';

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

test('Wix Blog installation detection accepts the installed-app slug and catalog ID', () => {
  assert.equal(isWixBlogInstalled(['members_about', 'blog', 'members_area']), true);
  assert.equal(isWixBlogInstalled(['14bcded7-0066-7c35-14d7-466cb3f09103']), true);
  assert.equal(isWixBlogInstalled([' BLOG ']), true);
  assert.equal(isWixBlogInstalled(['members_area', 'members_about']), false);
  assert.equal(isWixBlogInstalled(undefined), false);
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

test('Wix AI generation uses the managed provider and parses the article JSON', async () => {
  let callArgs = null;
  const result = await generateBlogArticle(
    { topic: 'sleep', audience: 'adults', tone: 'practical', instructions: 'Keep it useful.', seoKeywords: [] },
    {
      model: 'gpt-5-mini',
      generateText: async (args) => {
        callArgs = args;
        return { text: JSON.stringify(validArticle()) };
      },
    },
  );

  assert.equal(typeof callArgs.system, 'string');
  assert.match(callArgs.system, /valid JSON/);
  assert.match(callArgs.system, /no more than 5 strings/);
  assert.match(callArgs.system, /title 1-200 characters/);
  assert.match(callArgs.system, /under 30000 characters/);
  assert.equal(callArgs.prompt, JSON.stringify({
    topic: 'sleep', audience: 'adults', tone: 'practical', instructions: 'Keep it useful.', seoKeywords: [],
  }));
  assert.equal(callArgs.maxOutputTokens, 3500);
  assert.deepEqual(result, validArticle());
});

test('Wix AI generation rejects empty model configuration and malformed output', async () => {
  const brief = {
    topic: 'sleep', audience: 'adults', tone: 'practical', instructions: 'Keep it useful.', seoKeywords: [],
  };

  await assert.rejects(
    generateBlogArticle(brief, { model: '  ' }),
    (error) => error instanceof AiProviderError && error.status === 503,
  );

  await assert.rejects(
    generateBlogArticle(brief, {
      model: 'gpt-5-mini',
      generateText: async () => ({ text: 'not JSON' }),
    }),
    (error) => error instanceof AiProviderError && error.status === 502,
  );
});

test('Wix AI generation maps provider timeouts and permission failures to safe API errors', async () => {
  const brief = {
    topic: 'sleep', audience: 'adults', tone: 'practical', instructions: 'Keep it useful.', seoKeywords: [],
  };

  await assert.rejects(
    generateBlogArticle(brief, {
      model: 'gpt-5-mini',
      generateText: async () => { const error = new Error('timeout'); error.name = 'TimeoutError'; throw error; },
    }),
    (error) => error instanceof AiProviderError && error.status === 504,
  );

  await assert.rejects(
    generateBlogArticle(brief, {
      model: 'gpt-5-mini',
      generateText: async () => { throw new Error('permission denied'); },
    }),
    (error) => error instanceof AiProviderError && error.status === 503 && /Invoke AI Models/.test(error.message),
  );
});


const publicDns = async () => [{ address: '93.184.216.34', family: 4 }];
const sourceRecord = (id = 'S1') => ({
  id,
  title: 'Public research article',
  url: 'https://public.example.com/article',
  publisher: 'public.example.com',
  retrievedAt: '2026-10-28T12:00:00.000Z',
  excerpt: 'A sufficiently long public research excerpt for our deterministic tests.',
});

test('research URLs accept a short public URL list and reject unsafe, duplicate, and excessive inputs', () => {
  assert.deepEqual(
    parseResearchUrls('https://public.example.com/a\n\nhttps://public.example.org/b'),
    ['https://public.example.com/a', 'https://public.example.org/b'],
  );
  assert.deepEqual(parseResearchUrls(''), []);
  assert.throws(() => parseResearchUrls('file:///etc/passwd'), ResearchSourceError);
  assert.throws(() => parseResearchUrls('http://localhost/admin'), ResearchSourceError);
  assert.throws(() => parseResearchUrls('https://user:pass@public.example.com/a'), ResearchSourceError);
  assert.throws(() => parseResearchUrls('https://public.example.com/a\nhttps://public.example.com/a'), /duplicate/i);
  assert.throws(() => parseResearchUrls(Array.from({ length: 6 }, (_, index) => 'https://source' + index + '.example.com/a')), /no more than five/i);
});

test('research URL validation removes fragments and rejects private or mixed DNS results', async () => {
  const url = await validateResearchUrl('https://public.example.com/story#section', publicDns);
  assert.equal(url.href, 'https://public.example.com/story');

  await assert.rejects(
    validateResearchUrl('https://public.example.com/story', async () => [{ address: '127.0.0.1', family: 4 }]),
    ResearchSourceError,
  );
  await assert.rejects(
    validateResearchUrl('https://public.example.com/story', async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.12', family: 4 },
    ]),
    /public internet addresses/i,
  );
  await assert.rejects(
    validateResearchUrl('https://public.example.com/story', async () => [{ address: '::1', family: 6 }]),
    ResearchSourceError,
  );
});

test('research page extraction preserves article text and strips scripts and navigation', () => {
  const html = '<html><head><title>Practical Research Guide</title></head><body>' +
    '<nav>site navigation should disappear</nav><article><h1>Guide</h1>' +
    '<p>This is a sufficiently long article paragraph with useful facts and explanatory context.</p>' +
    '<script>ignore this injected text</script></article></body></html>';
  const result = extractResearchPage(html, new URL('https://public.example.com/guide'));
  assert.equal(result.title, 'Practical Research Guide');
  assert.match(result.excerpt, /useful facts/);
  assert.doesNotMatch(result.excerpt, /site navigation|injected text/);
  assert.throws(
    () => extractResearchPage('<html><body><p>tiny</p></body></html>', new URL('https://public.example.com/tiny')),
    (error) => error instanceof ResearchSourceError && error.status === 422,
  );
});

test('research import returns canonical source metadata from fetched pages', async () => {
  let fetchCalls = 0;
  const html = '<html><head><title>Public guide</title></head><body><article>' +
    '<p>This guide provides enough readable text to serve as a deterministic research source fixture.</p>' +
    '</article></body></html>';
  const sources = await loadResearchSources(['https://public.example.com/guide#top'], {
    resolveHost: publicDns,
    now: () => new Date('2026-10-28T12:00:00.000Z'),
    fetchImpl: async (input, init) => {
      fetchCalls += 1;
      assert.equal(String(input), 'https://public.example.com/guide');
      assert.equal(init?.redirect, 'manual');
      return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
    },
  });

  assert.equal(fetchCalls, 1);
  assert.equal(sources[0]?.id, 'S1');
  assert.equal(sources[0]?.title, 'Public guide');
  assert.equal(sources[0]?.publisher, 'public.example.com');
  assert.equal(sources[0]?.retrievedAt, '2026-10-28T12:00:00.000Z');
  assert.match(sources[0]?.excerpt ?? '', /deterministic research source fixture/);
});

test('research import revalidates redirects and rejects a redirect to localhost before fetching it', async () => {
  let fetchCalls = 0;
  await assert.rejects(
    loadResearchSources(['https://public.example.com/redirect'], {
      resolveHost: async (hostname) => {
        if (hostname === 'localhost') return [{ address: '127.0.0.1', family: 4 }];
        return [{ address: '93.184.216.34', family: 4 }];
      },
      fetchImpl: async () => {
        fetchCalls += 1;
        return new Response(null, { status: 302, headers: { location: 'http://localhost/private' } });
      },
    }),
    ResearchSourceError,
  );
  assert.equal(fetchCalls, 1);
});

test('research import rejects unsupported content types and oversized responses', async () => {
  await assert.rejects(
    loadResearchSources(['https://public.example.com/file'], {
      resolveHost: publicDns,
      fetchImpl: async () => new Response('binary', { status: 200, headers: { 'content-type': 'application/pdf' } }),
    }),
    (error) => error instanceof ResearchSourceError && error.status === 415,
  );
  await assert.rejects(
    loadResearchSources(['https://public.example.com/large'], {
      resolveHost: publicDns,
      maxBytes: 10,
      fetchImpl: async () => new Response('this response exceeds ten bytes', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      }),
    }),
    (error) => error instanceof ResearchSourceError && error.status === 413,
  );
});

test('citation integrity accepts only source IDs returned by the research loader', () => {
  const article = { ...validArticle(), introduction: 'Grounded claim [S1].' };
  assert.deepEqual(assertCitationIntegrity(article, [sourceRecord()]), ['S1']);
  assert.throws(
    () => assertCitationIntegrity({ ...article, introduction: 'Claim [S2].' }, [sourceRecord()]),
    /not supplied/i,
  );
  assert.throws(
    () => assertCitationIntegrity(validArticle(), [sourceRecord()]),
    /did not cite/i,
  );
  assert.deepEqual(assertCitationIntegrity(validArticle(), []), []);
});

test('Wix AI receives research excerpts with explicit citation instructions when sources are supplied', async () => {
  let callArgs = null;
  const sources = [sourceRecord()];
  const article = { ...validArticle(), introduction: 'Research-backed claim [S1].' };
  const result = await generateBlogArticle(
    { topic: 'sleep', audience: 'adults', tone: 'practical', instructions: 'Use evidence.', seoKeywords: [] },
    {
      model: 'gpt-5-mini',
      researchSources: sources,
      generateText: async (args) => {
        callArgs = args;
        return { text: JSON.stringify(article) };
      },
    },
  );

  assert.deepEqual(result, article);
  assert.match(callArgs.system, /untrusted webpage content/);
  assert.match(callArgs.system, /exact form \[S1\]/);
  assert.deepEqual(JSON.parse(callArgs.prompt).researchSources, sources);
});


test('draft rich content turns verified citation markers and source URLs into real Ricos links', () => {
  const source = {
    id: 'S1',
    title: 'Public research article',
    url: 'https://public.example.com/article',
  };
  const sources = parseResearchCitationSources([source]);
  const document = bodyToRichContent(
    '## Research\n\nA grounded claim [S1].\n\n## Sources\n\n- [S1] Public research article — https://public.example.com/article',
    sources,
  );
  const textNodes = document.nodes.flatMap((node) => node.nodes ?? [])
    .filter((node) => node.type === 'TEXT');
  const linkedCitation = textNodes.find((node) => node.textData?.text === '[S1]');
  assert.equal(linkedCitation?.textData?.decorations[0]?.type, 'LINK');
  assert.equal(linkedCitation?.textData?.decorations[0]?.linkData?.link?.url, source.url);
  const linkedUrl = textNodes.find((node) => node.textData?.text === source.url);
  assert.equal(linkedUrl?.textData?.decorations[0]?.type, 'LINK');
  assert.equal(linkedUrl?.textData?.decorations[0]?.linkData?.link?.url, source.url);
});

test('draft citation-source parsing rejects forged IDs, invalid schemes, and duplicate IDs', () => {
  assert.deepEqual(parseResearchCitationSources(undefined), []);
  assert.throws(
    () => parseResearchCitationSources([{ id: 'S7', title: 'Source', url: 'https://public.example.com/a' }]),
    /IDs must be unique IDs from S1 through S5/i,
  );
  assert.throws(
    () => parseResearchCitationSources([{ id: 'S1', title: 'Source', url: 'javascript:alert(1)' }]),
    ResearchSourceError,
  );
  assert.throws(
    () => parseResearchCitationSources([
      { id: 'S1', title: 'One', url: 'https://public.example.com/a' },
      { id: 'S1', title: 'Two', url: 'https://public.example.com/b' },
    ]),
    /unique IDs/i,
  );
});


test('local Wix development CORS permits localhost and known Wix-managed origins only', () => {
  assert.equal(isAllowedDevCorsOrigin('http://localhost:4321'), true);
  assert.equal(isAllowedDevCorsOrigin('http://127.0.0.1:4321'), true);
  assert.equal(isAllowedDevCorsOrigin('http://[::1]:4321'), true);
  assert.equal(isAllowedDevCorsOrigin('https://mysite.editor.wix.com'), true);
  assert.equal(isAllowedDevCorsOrigin('https://username.wixsite.com'), true);
  assert.equal(isAllowedDevCorsOrigin('https://mysite.wixstudio.io'), true);
  assert.equal(isAllowedDevCorsOrigin('https://012509d2-64ed-4670-bc27-8299e942673f.wix.run'), true);
  assert.equal(isAllowedDevCorsOrigin('https://dev-sitex1487338744.wixdev-sites.org'), true);
  assert.equal(isAllowedDevCorsOrigin('https://attacker.example'), false);
  assert.equal(isAllowedDevCorsOrigin('https://wix.com.attacker.example'), false);
  assert.equal(isAllowedDevCorsOrigin('https://unrelated.wix.com'), false);
  assert.equal(isAllowedDevCorsOrigin('https://nested.username.wixsite.com'), false);
  assert.equal(isAllowedDevCorsOrigin('https://nested.dev-sitex1487338744.wixdev-sites.org'), false);
  assert.equal(isAllowedDevCorsOrigin('https://dev-sitex1487338744.wixdev-sites.org.attacker.example'), false);
  assert.equal(isAllowedDevCorsOrigin('https://customer.wixdev-sites.org'), false);
  assert.equal(isAllowedDevCorsOrigin('http://malicious.wix.com'), false);
});

test('custom development origins must be explicitly configured as exact HTTPS origins', () => {
  const customOrigin = 'https://my-custom-development-domain.example';
  assert.equal(isAllowedDevCorsOrigin(customOrigin), false);
  assert.equal(isAllowedDevCorsOrigin(customOrigin, customOrigin), true);
  assert.equal(isAllowedDevCorsOrigin('https://another-domain.example', customOrigin), false);
  assert.throws(() => getAllowedDevCorsOrigins('https://my-domain.example/path'), /exact HTTPS origins/);
  assert.throws(() => getAllowedDevCorsOrigins('http://my-domain.example'), /exact HTTPS origins/);
});
