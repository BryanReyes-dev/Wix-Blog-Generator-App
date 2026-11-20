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
} from '../src/lib/blog-content.ts';
import {
  articleBodyToDocumentWithMedia,
  articleDocumentToPlainText,
  articleDocumentToRichContent,
} from '../src/lib/article-document.ts';
import { createSubmissionGate } from '../src/lib/server/draft-submissions.ts';
import { AI_GENERATION_TIMEOUT_MS, AiProviderError, generateBlogArticle } from '../src/lib/server/generate-blog-article.ts';
import { isWixBlogInstalled } from '../src/lib/server/wix-blog-installation.ts';
import { getMediaFileInfo } from '../src/lib/media-file-types.ts';
import {
  extractResearchPage,
  loadResearchSources,
  loadResearchSourcesIndividually,
  MAX_RESEARCH_PDF_PAGES,
  MAX_RESEARCH_RESPONSE_BYTES,
  parseResearchLinkEntries,
} from '../src/lib/server/research-sources.ts';
import { parseMediaReferences, parseDraftMediaInputs } from '../src/lib/server/media-references.ts';
import { ARTICLE_TEMPLATES, DEFAULT_ARTICLE_DESIGN, parseArticleDesign } from '../src/lib/article-layout.ts';
import {
  RESEARCH_NETWORK_DIAGNOSTICS_BUILD,
  runResearchNetworkDiagnostics,
} from '../src/lib/server/research-network-diagnostics.ts';

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
    { heading: 'Build a steady routine', body: 'Choose a regular time to wind down.', layout: 'standard' },
    { heading: 'Make the room comfortable', body: 'Reduce light and noise where possible.', layout: 'standard' },
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

test('Wix AI generation uses the managed provider and requests a structured article object', async () => {
  let callArgs = null;
  const result = await generateBlogArticle(
    { topic: 'sleep', audience: 'adults', tone: 'practical', instructions: 'Keep it useful.', seoKeywords: [] },
    {
      model: 'gpt-5-mini',
      generateStructuredOutput: async (args) => {
        callArgs = args;
        return { output: { ...validArticle(), mediaPlacements: [] } };
      },
    },
  );

  assert.equal(typeof callArgs.system, 'string');
  assert.match(callArgs.system, /structured article object/);
  assert.match(callArgs.system, /no more than 5 strings/);
  assert.match(callArgs.system, /title 1-200 characters/);
  assert.match(callArgs.system, /under 30000 characters/);
  assert.equal(callArgs.schema.safeParse({ ...validArticle(), mediaPlacements: [] }).success, true);
  assert.equal(callArgs.schema.safeParse({ ...validArticle(), mediaPlacements: [], unexpected: true }).success, false);
  assert.equal(callArgs.prompt, JSON.stringify({
    topic: 'sleep', audience: 'adults', tone: 'practical', instructions: 'Keep it useful.', seoKeywords: [],
  }));
  assert.equal(callArgs.maxOutputTokens, 3500);
  assert.deepEqual(result, validArticle());
});

test('Wix AI structured-output schema requires mediaPlacements even when no media is attached', async () => {
  const brief = {
    topic: 'small-apartment houseplants',
    audience: 'first-time plant owners',
    tone: 'friendly and practical',
    instructions: 'Explain easy plant care for small homes.',
    seoKeywords: ['low-maintenance houseplants'],
  };
  let capturedSchema;
  let capturedSystem = '';

  const result = await generateBlogArticle(brief, {
    model: 'gpt-5-mini',
    generateStructuredOutput: async ({ schema, system }) => {
      capturedSchema = schema;
      capturedSystem = system;
      return { output: { ...validArticle(), mediaPlacements: [] } };
    },
  });

  assert.ok(capturedSchema);
  assert.equal(capturedSchema.safeParse(validArticle()).success, false);
  assert.equal(capturedSchema.safeParse({ ...validArticle(), mediaPlacements: [] }).success, true);
  assert.match(capturedSystem, /Always include mediaPlacements as an array/);
  assert.deepEqual(result, validArticle());
});

test('Wix AI generation rejects empty model configuration and invalid article objects', async () => {
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
      generateStructuredOutput: async () => ({ output: { ...validArticle(), sections: [] } }),
    }),
    (error) => error instanceof AiProviderError && error.status === 502 && /required format/i.test(error.message),
  );

  await assert.rejects(
    generateBlogArticle(brief, {
      model: 'gpt-5-mini',
      generateStructuredOutput: async () => {
        const error = new Error('No structured output generated');
        error.name = 'NoObjectGeneratedError';
        throw error;
      },
    }),
    (error) => error instanceof AiProviderError && error.status === 502 && /required format/i.test(error.message),
  );
});

test('Wix AI response-limit failures return actionable feedback', async () => {
  const brief = {
    topic: 'sleep', audience: 'adults', tone: 'practical', instructions: 'Keep it useful.', seoKeywords: [],
  };

  await assert.rejects(
    generateBlogArticle(brief, {
      model: 'gpt-5-mini',
      generateStructuredOutput: async () => {
        const error = new Error('No structured output generated');
        error.name = 'NoObjectGeneratedError';
        error.finishReason = 'length';
        throw error;
      },
    }),
    (error) => error instanceof AiProviderError && error.status === 502 && /response limit/i.test(error.message),
  );
});

test('Wix AI generation maps provider timeouts and permission failures to safe API errors', async () => {
  const brief = {
    topic: 'sleep', audience: 'adults', tone: 'practical', instructions: 'Keep it useful.', seoKeywords: [],
  };

  await assert.rejects(
    generateBlogArticle(brief, {
      model: 'gpt-5-mini',
      generateStructuredOutput: async () => { const error = new Error('timeout'); error.name = 'TimeoutError'; throw error; },
    }),
    (error) => error instanceof AiProviderError && error.status === 504,
  );

  await assert.rejects(
    generateBlogArticle(brief, {
      model: 'gpt-5-mini',
      generateStructuredOutput: async () => { throw new Error('permission denied'); },
    }),
    (error) => error instanceof AiProviderError && error.status === 503 && /Invoke AI Models/.test(error.message),
  );
});


test('article media references receive one validated editorial placement each', () => {
  const referenceId = 'b30d6826-5de3-4ef6-8f4d-e7fa80c05357';
  const article = parseGeneratedArticle({
    ...validArticle(),
    mediaPlacements: [{
      referenceId,
      sectionIndex: 0,
      afterParagraph: 1,
      caption: 'A close look at the finished product.',
      altText: 'Finished product on a wooden table.',
    }],
  }, [{ id: referenceId, name: 'product.png' }]);

  assert.deepEqual(article.mediaPlacements, [{
    referenceId,
    sectionIndex: 0,
    afterParagraph: 1,
    caption: 'A close look at the finished product.',
    altText: 'Finished product on a wooden table.',
    layout: 'wide',
    galleryGroup: '',
    layoutText: '',
  }]);

  assert.throws(() => parseGeneratedArticle({
    ...validArticle(),
    mediaPlacements: [{ referenceId: 'unknown-reference', sectionIndex: 0, afterParagraph: 0 }],
  }, [{ id: referenceId, name: 'product.png' }]), InputValidationError);
});

test('reference images become editable Wix image blocks at AI-selected placements', () => {
  const referenceId = 'b30d6826-5de3-4ef6-8f4d-e7fa80c05357';
  const uploadToken = 'c30d6826-5de3-4ef6-8f4d-e7fa80c05358';
  const body = '## Introduction\n\nOpening paragraph.\n\n## Build a steady routine\n\nFirst section paragraph.\n\nSecond section paragraph.\n\n## Make the room comfortable\n\nAnother paragraph.\n\n## Conclusion\n\nClosing paragraph.';
  let nextId = 0;
  const document = articleBodyToDocumentWithMedia(
    body,
    [{
      referenceId,
      sectionIndex: 0,
      afterParagraph: 1,
      caption: 'A finished room.',
      altText: 'A bright living room with plants.',
      layout: 'wide',
      galleryGroup: '',
      layoutText: '',
    }],
    [{
      referenceId,
      media: {
        id: 'wix_original_image_id',
        url: 'https://static.wixstatic.com/media/wix_original_image_id',
        name: 'living-room.png',
        mimeType: 'image/png',
        uploadToken,
        width: 1600,
        height: 1000,
      },
    }],
    () => 'generated-block-' + (++nextId),
  );

  const imageIndex = document.blocks.findIndex((block) => block.type === 'image');
  assert.ok(imageIndex > 0);
  assert.equal(document.blocks[imageIndex - 1]?.type, 'paragraph');
  assert.equal(document.blocks[imageIndex - 1]?.text, 'First section paragraph.');

  const richContent = articleDocumentToRichContent(document);
  const imageNode = richContent.nodes.find((node) => node.type === 'IMAGE');
  assert.ok(imageNode);
  assert.equal(imageNode.imageData.image.src.id, 'wix_original_image_id');
  assert.equal(imageNode.imageData.altText, 'A bright living room with plants.');
  assert.match(articleDocumentToPlainText(document), /\[Image: A bright living room with plants\.\] A finished room\./);
});

test('Wix Rich Content inserts the original uploaded image at its reviewed placement', () => {
  const referenceId = 'b30d6826-5de3-4ef6-8f4d-e7fa80c05357';
  const body = '## Introduction\\n\\nAn opening paragraph.\\n\\n## Build a steady routine\\n\\nA section paragraph.\\n\\n## Make the room comfortable\\n\\nAnother paragraph.\\n\\n## Conclusion\\n\\nA closing paragraph.';
  const richContent = bodyToRichContent(body, [], [{
    referenceId,
    fileId: 'site_image_file_id~mv2.png',
    name: 'room.png',
    kind: 'image',
    fileUrl: 'https://static.wixstatic.com/media/site_image_file_id~mv2.png',
    width: 1200,
    height: 800,
  }], [{
    referenceId,
    sectionIndex: 0,
    afterParagraph: 0,
    caption: 'A quiet reading corner.',
    altText: 'A chair beside a lamp and bookshelf.',
    layout: 'wide',
    galleryGroup: '',
    layoutText: '',
  }]);

  const imageNode = richContent.nodes.find((node) => node.type === 'IMAGE');
  assert.ok(imageNode);
  assert.equal(imageNode.imageData.image.src.id, 'site_image_file_id~mv2.png');
  assert.equal(imageNode.imageData.altText, 'A chair beside a lamp and bookshelf.');
  assert.equal(imageNode.nodes[0].type, 'CAPTION');
});

test('media input validation recognizes image, video, audio, and downloadable document types', () => {
  assert.equal(getMediaFileInfo('cover.PNG')?.kind, 'image');
  assert.equal(getMediaFileInfo('launch.MOV')?.kind, 'video');
  assert.equal(getMediaFileInfo('interview.mp3')?.kind, 'audio');
  assert.equal(getMediaFileInfo('press-kit.PDF')?.kind, 'document');
  assert.equal(getMediaFileInfo('unknown.exe'), null);

  const referenceId = 'b30d6826-5de3-4ef6-8f4d-e7fa80c05357';
  const references = parseMediaReferences([{
    id: referenceId,
    name: 'interview.mp3',
    kind: 'audio',
    notes: '',
    frames: [],
  }]);
  assert.equal(references[0].kind, 'audio');

  const uploads = parseDraftMediaInputs([{
    referenceId,
    fileId: 'site_audio_file_id',
    name: 'interview.mp3',
    kind: 'audio',
    mimeType: 'audio/mpeg',
  }]);
  assert.equal(uploads[0].fileId, 'site_audio_file_id');
});


test('Wix rich content keeps video and audio playable and documents downloadable', () => {
  const references = [
    { referenceId: 'b30d6826-5de3-4ef6-8f4d-e7fa80c05357', fileId: 'site_video_file_id', name: 'launch.mp4', kind: 'video', fileUrl: 'https://video.wixstatic.com/video/site_video_file_id/file', videoMediaId: 'video/site_video_file_id/1080p/mp4/file.mp4', durationSeconds: 42 },
    { referenceId: 'c30d6826-5de3-4ef6-8f4d-e7fa80c05358', fileId: 'site_audio_file_id', name: 'interview.mp3', kind: 'audio', fileUrl: 'https://static.wixstatic.com/media/site_audio_file_id' },
    { referenceId: 'd30d6826-5de3-4ef6-8f4d-e7fa80c05359', fileId: 'site_pdf_file_id', name: 'press-kit.pdf', kind: 'document', fileUrl: 'https://static.wixstatic.com/media/site_pdf_file_id' },
  ];
  const placements = references.map((reference, index) => ({
    referenceId: reference.referenceId,
    sectionIndex: -1,
    afterParagraph: index,
    caption: reference.name,
    altText: reference.name,
  }));
  const richContent = bodyToRichContent('## Introduction\\n\\nOpening paragraph.', [], references, placements);
  assert.equal(richContent.nodes.some((node) => node.type === 'VIDEO'), true);
  assert.equal(richContent.nodes.some((node) => node.type === 'AUDIO'), true);
  assert.equal(richContent.nodes.some((node) => node.type === 'PARAGRAPH' && node.nodes?.some((child) => child.textData?.text === 'press-kit.pdf')), true);
});


test('research source requests use standard browser-compatible headers', async () => {
  let requestHeaders;
  const html = '<html><head><title>Accessible Houseplant Guide</title></head><body><main><p>This is a sufficiently long public article excerpt for the research importer test.</p></main></body></html>';

  const sources = await loadResearchSources(
    ['https://public.example.org/houseplants'],
    {
      resolveHost: async () => [{ address: '8.8.8.8', family: 4 }],
      fetchImpl: async (_url, init) => {
        requestHeaders = new Headers(init?.headers);
        return new Response(html, {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      },
      now: () => new Date('2026-11-13T12:00:00.000Z'),
    },
  );

  assert.equal(requestHeaders.get('user-agent')?.startsWith('Mozilla/5.0'), true);
  assert.equal(requestHeaders.get('accept-language'), 'en-US,en;q=0.9');
  assert.equal(sources.length, 1);
  assert.equal(sources[0].title, 'Accessible Houseplant Guide');
});


test('article design presets validate template, color, and visual density', () => {
  assert.equal(ARTICLE_TEMPLATES.length, 3);
  assert.deepEqual(parseArticleDesign(undefined), DEFAULT_ARTICLE_DESIGN);
  assert.deepEqual(parseArticleDesign({
    templateId: 'visual',
    accentColor: '#b84b32',
    density: 'visual-rich',
  }), {
    templateId: 'visual',
    accentColor: '#B84B32',
    density: 'visual-rich',
  });
  assert.throws(() => parseArticleDesign({ templateId: 'custom-css', accentColor: '#fff', density: 'balanced' }));
  assert.throws(() => parseArticleDesign({ templateId: 'editorial', accentColor: 'red', density: 'balanced' }));
});

test('generated media layout is constrained by the selected template', () => {
  const referenceId = 'b30d6826-5de3-4ef6-8f4d-e7fa80c05357';
  const article = parseGeneratedArticle({
    ...validArticle(),
    mediaPlacements: [{
      referenceId,
      sectionIndex: 0,
      afterParagraph: 1,
      caption: 'A useful visual note.',
      altText: 'A potted plant beside a window.',
      layout: 'gallery',
      galleryGroup: 'plants-gallery',
      layoutText: '',
    }],
  }, [{ id: referenceId, name: 'plant.png', kind: 'image' }], {
    templateId: 'minimal',
    accentColor: '#465366',
    density: 'quiet',
  });
  assert.equal(article.mediaPlacements?.[0]?.layout, 'wide');
  assert.equal(article.mediaPlacements?.[0]?.galleryGroup, '');
});

test('Wix Rich Content renders paired images as a gallery and split images as tables', () => {
  const firstId = 'b30d6826-5de3-4ef6-8f4d-e7fa80c05357';
  const secondId = 'c30d6826-5de3-4ef6-8f4d-e7fa80c05358';
  const thirdId = 'd30d6826-5de3-4ef6-8f4d-e7fa80c05359';
  const body = '## Introduction\n\nOpening paragraph.\n\n## Plant choices\n\nA section paragraph.';
  const assets = [
    { referenceId: firstId, fileId: 'site_image_one', name: 'plant-one.png', kind: 'image', fileUrl: 'https://static.wixstatic.com/media/site_image_one', width: 1200, height: 900 },
    { referenceId: secondId, fileId: 'site_image_two', name: 'plant-two.png', kind: 'image', fileUrl: 'https://static.wixstatic.com/media/site_image_two', width: 1200, height: 900 },
    { referenceId: thirdId, fileId: 'site_image_three', name: 'plant-three.png', kind: 'image', fileUrl: 'https://static.wixstatic.com/media/site_image_three', width: 1200, height: 900 },
  ];
  const richContent = bodyToRichContent(body, [], assets, [
    { referenceId: firstId, sectionIndex: 0, afterParagraph: 1, caption: 'Plant one', altText: 'Plant one', layout: 'gallery', galleryGroup: 'plants', layoutText: '' },
    { referenceId: secondId, sectionIndex: 0, afterParagraph: 1, caption: 'Plant two', altText: 'Plant two', layout: 'gallery', galleryGroup: 'plants', layoutText: '' },
    { referenceId: thirdId, sectionIndex: 0, afterParagraph: 1, caption: 'Plant three', altText: 'Plant three', layout: 'split-right', galleryGroup: '', layoutText: 'An easy-care choice for a bright corner.' },
  ]);
  const gallery = richContent.nodes.find((node) => node.type === 'GALLERY');
  const split = richContent.nodes.find((node) => node.type === 'TABLE');
  assert.ok(gallery);
  assert.equal(gallery.galleryData.items.length, 2);
  assert.ok(split);
  assert.equal(split.nodes[0].nodes.length, 2);
});


test('generated article section patterns are constrained by the selected template', () => {
  const generated = {
    ...validArticle(),
    sections: [
      { heading: 'A useful warning', body: 'Avoid overwatering the plant.', layout: 'callout' },
      { heading: 'A simple routine', body: 'Check the soil.\n\nWater only when needed.', layout: 'steps' },
    ],
  };
  const editorial = parseGeneratedArticle(generated, [], {
    templateId: 'editorial', accentColor: '#8A6E4B', density: 'balanced',
  });
  assert.deepEqual(editorial.sections.map((section) => section.layout), ['callout', 'steps']);

  const minimal = parseGeneratedArticle(generated, [], {
    templateId: 'minimal', accentColor: '#465366', density: 'quiet',
  });
  assert.deepEqual(minimal.sections.map((section) => section.layout), ['callout', 'standard']);
});

test('Wix Rich Content serializes callout and step section patterns', () => {
  const body = '## Introduction\n\nOpening paragraph.\n\n## A useful warning\n\nAvoid overwatering the plant.\n\n## A simple routine\n\nCheck the soil first.\n\nWater only when needed.';
  const richContent = bodyToRichContent(body, [], [], [], ['callout', 'steps']);
  const callout = richContent.nodes.find((node) => node.type === 'BLOCKQUOTE');
  const steps = richContent.nodes.find((node) => node.type === 'ORDERED_LIST');
  assert.ok(callout);
  assert.equal(callout.nodes[0].type, 'PARAGRAPH');
  assert.ok(steps);
  assert.equal(steps.nodes.length, 2);
  assert.equal(steps.nodes[0].type, 'LIST_ITEM');
});

test('draft submission carries validated article design and section patterns', () => {
  const submission = parseDraftSubmission({
    submissionId: 'b30d6826-5de3-4ef6-8f4d-e7fa80c05357',
    title: validArticle().title,
    body: '## Introduction\n\nOpening.\n\n## A section\n\nBody.',
    metaDescription: validArticle().metaDescription,
    seoKeywords: validArticle().seoKeywords,
    seoSlug: 'a-practical-sleep-guide',
    hashtags: ['#Sleep', 'wellness', 'Sleep'],
    featured: true,
    design: { templateId: 'visual', accentColor: '#B84B32', density: 'visual-rich' },
    sectionLayouts: ['steps'],
  });
  assert.equal(submission.design.templateId, 'visual');
  assert.deepEqual(submission.sectionLayouts, ['steps']);
  assert.equal(submission.seoSlug, 'a-practical-sleep-guide');
  assert.deepEqual(submission.hashtags, ['Sleep', 'wellness']);
  assert.equal(submission.featured, true);
});



test('research link parsing preserves row IDs and defers URL errors to individual checks', () => {
  const links = parseResearchLinkEntries([
    { id: 'row-invalid', url: 'not-a-url', notes: '' },
    { id: 'row-valid', url: 'https://example.org/article', notes: 'Use this page.' },
  ]);

  assert.deepEqual(links.map((link) => link.id), ['row-invalid', 'row-valid']);
  assert.equal(links[0].url, 'not-a-url');
  assert.equal(links[1].notes, 'Use this page.');
});

test('research links are checked independently and successful sources survive sibling failures', async () => {
  const html = '<html><head><title>Working Research Page</title></head><body><main><p>This is a sufficiently long public article excerpt for the independent research link test.</p></main></body></html>';
  const requests = [];
  const links = [
    { id: 'blocked-source', url: 'https://blocked.example.org/article', notes: 'Check the source status.' },
    { id: 'working-source', url: 'https://working.example.org/article', notes: 'Use this source.' },
    { id: 'private-host', url: 'http://localhost/private', notes: '' },
  ];

  const result = await loadResearchSourcesIndividually(links, {
    resolveHost: async () => [{ address: '8.8.8.8', family: 4 }],
    fetchImpl: async (url) => {
      const hostname = new URL(url).hostname;
      requests.push(hostname);
      if (hostname === 'blocked.example.org') {
        return new Response('Forbidden', { status: 403 });
      }
      return new Response(html, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    },
    now: () => new Date('2026-11-19T12:00:00.000Z'),
  });

  assert.equal(result.checks.length, 3);
  assert.deepEqual(result.checks.map((check) => check.id), [
    'blocked-source',
    'working-source',
    'private-host',
  ]);
  assert.deepEqual(result.checks.map((check) => check.status), ['error', 'success', 'error']);
  assert.match(result.checks[0].message, /blocked automated access.*403/i);
  assert.equal(result.checks[1].title, 'Working Research Page');
  assert.match(result.checks[2].message, /public website/i);
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].id, 'S2');
  assert.deepEqual(requests.sort(), ['blocked.example.org', 'working.example.org']);
});

test('research fetch failures expose sanitized nested network diagnostics', async () => {
  const cause = Object.assign(
    new Error('connect ECONNRESET to https://private.example.test/article at 192.0.2.10'),
    {
      code: 'ECONNRESET',
      cause: Object.assign(new Error('socket closed'), { code: 'UND_ERR_SOCKET' }),
    },
  );
  const fetchFailure = new TypeError('fetch failed', { cause });

  const result = await loadResearchSourcesIndividually([
    { id: 'fetch-failure', url: 'https://public.example.org/article', notes: '' },
  ], {
    resolveHost: async () => [{ address: '8.8.8.8', family: 4 }],
    fetchImpl: async () => { throw fetchFailure; },
  });

  assert.equal(result.checks[0].status, 'error');
  assert.match(result.checks[0].message, /could not be reached because the connection failed/i);
  assert.deepEqual(result.checks[0].diagnostic, {
    code: 'FETCH_ECONNRESET',
    stage: 'fetch',
    errorName: 'TypeError',
    errorMessage: 'fetch failed',
    causeName: 'Error',
    causeCode: 'ECONNRESET',
    causeMessage: 'connect ECONNRESET to [url] at [ip]',
  });
  assert.doesNotMatch(JSON.stringify(result.checks[0].diagnostic), /private\.example\.test|192\.0\.2\.10/);
});

test('duplicate research URLs are reported against the later row only', async () => {
  const html = '<html><head><title>One Working Page</title></head><body><main><p>This excerpt is long enough to use as a valid research source in the duplicate check test.</p></main></body></html>';
  let requests = 0;
  const result = await loadResearchSourcesIndividually([
    { id: 'first', url: 'https://public.example.org/article', notes: '' },
    { id: 'duplicate', url: 'https://public.example.org/article#top', notes: '' },
  ], {
    resolveHost: async () => [{ address: '8.8.8.8', family: 4 }],
    fetchImpl: async () => {
      requests += 1;
      return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
    },
  });

  assert.deepEqual(result.checks.map((check) => check.status), ['success', 'error']);
  assert.match(result.checks[1].message, /duplicates an earlier research link/i);
  assert.equal(result.sources.length, 1);
  assert.equal(requests, 1);
});

test('research HTML extraction prefers article content and excludes common page chrome', () => {
  const html = '<html><head><title>Winter Wardrobe Guide</title></head><body>' +
    '<nav><p>Navigation text that should never be supplied to the model.</p></nav>' +
    '<main><article class="article-content"><h1>Winter Wardrobe Guide</h1>' +
    '<p>A practical article paragraph with information about layering and winter clothing.</p>' +
    '<p>Another paragraph with useful information about coats, footwear, and cold weather.</p>' +
    '</article><aside class="related-articles"><p>Related content that should not be imported.</p></aside></main>' +
    '<footer><p>Footer text that should never be supplied to the model.</p></footer></body></html>';
  const result = extractResearchPage(html, new URL('https://public.example.org/winter'));
  assert.equal(result.title, 'Winter Wardrobe Guide');
  assert.match(result.excerpt, /layering and winter clothing/);
  assert.doesNotMatch(result.excerpt, /Navigation text|Related content|Footer text/);
});

test('HTML research pages larger than 1 MiB are fetched while model excerpts stay bounded', async () => {
  const repeatedParagraph = '<p>' + 'A detailed winter clothing paragraph. '.repeat(36_000) + '</p>';
  const html = '<html><head><title>Large Article</title></head><body><article>' + repeatedParagraph + '</article></body></html>';
  assert.ok(new TextEncoder().encode(html).byteLength > 1_048_576);
  assert.ok(new TextEncoder().encode(html).byteLength < MAX_RESEARCH_RESPONSE_BYTES);

  const result = await loadResearchSourcesIndividually([
    { id: 'large-article', url: 'https://public.example.org/large-article', notes: '' },
  ], {
    resolveHost: async () => [{ address: '8.8.8.8', family: 4 }],
    fetchImpl: async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } }),
  });

  assert.equal(result.checks[0].status, 'success');
  assert.equal(result.sources[0].excerpt.length, 6_000);
});

test('text-based research PDFs are extracted live with page and character limits', async () => {
  const pdfBytes = new TextEncoder().encode('%PDF-1.7 mock PDF bytes');
  let parserLimits;
  const result = await loadResearchSourcesIndividually([
    { id: 'pdf-report', url: 'https://public.example.org/report.pdf', notes: '' },
  ], {
    resolveHost: async () => [{ address: '8.8.8.8', family: 4 }],
    fetchImpl: async () => new Response(pdfBytes, { status: 200, headers: { 'content-type': 'application/pdf' } }),
    parsePdf: async (_bytes, maxPages, maxCharacters) => {
      parserLimits = { maxPages, maxCharacters };
      return {
        title: 'Winter Climate Report',
        pageCount: 2,
        pageTexts: ['A sufficiently long extracted PDF passage about winter climate and layering.'],
      };
    },
  });

  assert.equal(result.checks[0].status, 'success');
  assert.equal(result.sources[0].title, 'Winter Climate Report');
  assert.equal(result.sources[0].publisher, 'public.example.org');
  assert.deepEqual(parserLimits, { maxPages: MAX_RESEARCH_PDF_PAGES, maxCharacters: 6_000 });
});

test('research PDFs over the configured byte limit are rejected before parsing', async () => {
  let parserCalled = false;
  const pdfBytes = new Uint8Array(32).fill(37);
  const result = await loadResearchSourcesIndividually([
    { id: 'oversized-pdf', url: 'https://public.example.org/oversized.pdf', notes: '' },
  ], {
    resolveHost: async () => [{ address: '8.8.8.8', family: 4 }],
    fetchImpl: async () => new Response(pdfBytes, { status: 200, headers: { 'content-type': 'application/pdf' } }),
    maxPdfBytes: 16,
    parsePdf: async () => { parserCalled = true; return { pageCount: 1, pageTexts: ['valid enough text for the parser output'] }; },
  });

  assert.equal(result.checks[0].status, 'error');
  assert.match(result.checks[0].message, /larger than the 5 MiB research limit/i);
  assert.equal(parserCalled, false);
});

test('research PDFs over the page limit are rejected per link', async () => {
  const pdfBytes = new TextEncoder().encode('%PDF-1.7 mock PDF bytes');
  const result = await loadResearchSourcesIndividually([
    { id: 'long-pdf', url: 'https://public.example.org/long-report.pdf', notes: '' },
  ], {
    resolveHost: async () => [{ address: '8.8.8.8', family: 4 }],
    fetchImpl: async () => new Response(pdfBytes, { status: 200, headers: { 'content-type': 'application/pdf' } }),
    parsePdf: async () => ({ title: 'Long Report', pageCount: 21, pageTexts: [] }),
  });

  assert.equal(result.checks[0].status, 'error');
  assert.match(result.checks[0].message, /more than 20 pages/i);
  assert.equal(result.sources.length, 0);
});

test('Wix AI generation is configured to wait five minutes before timing out', () => {
  assert.equal(AI_GENERATION_TIMEOUT_MS, 5 * 60 * 1_000);
});


test('research network diagnostics report the fixed DNS and HTTPS probes without exposing resolved addresses', async () => {
  let resolvedHostname = '';
  let requestedUrl = '';
  let requestOptions;
  const result = await runResearchNetworkDiagnostics({
    resolveHost: async (hostname) => {
      resolvedHostname = hostname;
      return [
        { address: '208.80.154.224', family: 4 },
        { address: '2620:0:861:ed1a::1', family: 6 },
      ];
    },
    fetchImpl: async (url, init) => {
      requestedUrl = String(url);
      requestOptions = init;
      return new Response('<html></html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    },
  });

  assert.equal(result.diagnosticBuild, RESEARCH_NETWORK_DIAGNOSTICS_BUILD);
  assert.equal(result.target, 'www.wikipedia.org');
  assert.equal(resolvedHostname, 'www.wikipedia.org');
  assert.equal(requestedUrl, 'https://www.wikipedia.org/');
  assert.equal(requestOptions.method, 'GET');
  assert.equal(requestOptions.redirect, 'manual');
  assert.equal(result.checks.dns.status, 'ok');
  assert.equal(result.checks.dns.resolvedAddressCount, 2);
  assert.equal(result.checks.https.status, 'reachable');
  assert.equal(result.checks.https.httpStatus, 200);
  assert.equal(result.checks.https.contentType, 'text/html');
  assert.doesNotMatch(JSON.stringify(result), /208\.80\.154\.224|2620:0:861/);
});

test('research network diagnostics identify DNS and outbound HTTPS failures independently', async () => {
  const dnsCause = Object.assign(
    new Error('lookup failed for https://private.example.test at 192.0.2.10'),
    { code: 'EAI_AGAIN' },
  );
  const dnsFailure = new TypeError('fetch failed', { cause: dnsCause });
  const httpsCause = Object.assign(
    new Error('connect ECONNRESET to https://private.example.test/article at 198.51.100.20'),
    { code: 'ECONNRESET' },
  );
  const httpsFailure = new TypeError('fetch failed', { cause: httpsCause });

  const result = await runResearchNetworkDiagnostics({
    resolveHost: async () => { throw dnsFailure; },
    fetchImpl: async () => { throw httpsFailure; },
  });

  assert.equal(result.checks.dns.status, 'error');
  assert.equal(result.checks.dns.diagnostic.code, 'DNS_EAI_AGAIN');
  assert.equal(result.checks.dns.diagnostic.causeCode, 'EAI_AGAIN');
  assert.equal(result.checks.https.status, 'failed');
  assert.equal(result.checks.https.diagnostic.code, 'FETCH_ECONNRESET');
  const serialized = JSON.stringify(result.checks);
  assert.doesNotMatch(serialized, /private\.example\.test|192\.0\.2\.10|198\.51\.100\.20/);
});

test('individual research-link results include sanitized DNS-stage diagnostics', async () => {
  const dnsCause = Object.assign(
    new Error('lookup failed for https://private.example.test/article at 203.0.113.8'),
    { code: 'EAI_AGAIN' },
  );
  const result = await loadResearchSourcesIndividually([
    { id: 'dns-failure', url: 'https://public.example.org/article', notes: '' },
  ], {
    resolveHost: async () => { throw new TypeError('fetch failed', { cause: dnsCause }); },
    fetchImpl: async () => {
      throw new Error('The page fetch should not run when DNS validation fails.');
    },
  });

  assert.equal(result.checks[0].status, 'error');
  assert.match(result.checks[0].message, /hostname could not be verified/i);
  assert.deepEqual(result.checks[0].diagnostic, {
    code: 'DNS_EAI_AGAIN',
    stage: 'dns_lookup',
    errorName: 'TypeError',
    errorMessage: 'fetch failed',
    causeName: 'Error',
    causeCode: 'EAI_AGAIN',
    causeMessage: 'lookup failed for [url] at [ip]',
  });
  assert.doesNotMatch(JSON.stringify(result.checks[0].diagnostic), /private\.example\.test|203\.0\.113\.8/);
});
