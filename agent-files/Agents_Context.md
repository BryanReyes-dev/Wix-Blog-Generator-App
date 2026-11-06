# Wix Blog Generator — Agents Context

> Purpose: short-term working context for Bryan and coding agents working in this repository.
>
> This file records current status, immediate goals, discoveries, and handoffs. It is not the authoritative architecture document. Keep it concise and update existing notes rather than accumulating duplicate history.

## Current project identity

Wix Blog Generator is a Wix CLI/Astro application with a React site widget. Approved Wix site members can generate an article from a brief, optional research links, and visual reference files; review/edit the result; and explicitly save an unpublished Wix Blog draft.

The project is an app workflow, not a standalone model service. Wix owns member authentication, app permissions, AI provider access, media storage, and Blog draft persistence.

## Current implementation status

- The workflow UI lives in src/extensions/site/widgets/member-login-test/blog-workflow.tsx.
- Protected generation and draft endpoints live under src/pages/api/workflow/.
- Server-side authorization and access-control helpers verify Wix identity and require an approved site member before generation or draft creation.
- Article generation uses @wix/ai with the Vercel AI SDK. The model is configured with WIX_AI_MODEL and defaults to gpt-5-mini. A direct OPENAI_API_KEY is not required by the current code.
- Research URL retrieval and citation validation live in src/lib/server/research-sources.ts.
- Generation-page uploads remain visual references for Wix AI: images are normalized into JPEG analysis frames and videos are sampled into still frames. They are not automatically embedded in a post.
- The editorial workspace has a separate original-image upload path for JPEG, PNG, WebP, and GIF. It uses the Wix Media Manager upload URL API, validates file signatures, and checks `operationStatus` until the descriptor is `READY`. Original GIFs are retained for article embedding; editor uploads are limited to 10 MB per image.
- `src/lib/article-document.ts` defines and validates the shared structured block document, serializes it for legacy body validation, and converts it to Wix Ricos nodes. The browser editor and preview consume the same document model.
- Reusable editor components live in `src/extensions/site/widgets/member-login-test/editor/`: `ArticleEditor`, `EditorBlock`, `AppearancePanel`, `ArticlePreview`, `ArticleReview`, and `EditorIcon`.
- Text styling, background colors, paragraph spacing, image alignment/width, `textWrap`, and image border settings are represented in Wix Ricos fields. The preview canvas background is editor-only; the Wix site's overall theme remains site-controlled.
- The local preview displays article content in desktop/mobile frames but is not a pixel-identical Wix page preview. Site header, footer, theme, and actual post rendering still need development-site verification.
- The draft endpoint requires the original generating member, an approved member session, an installed Wix Blog app, and an explicit save action. It passes `publish: false`; no publish or scheduling endpoint was added.

## Current editor and media implementation

The structured editorial workspace and original image insertion are implemented on `feat/editorial-workspace-and-media`. The editor and preview share one `ArticleDocument`; the draft route validates that document and converts it into Wix Ricos rich content. The previous Markdown converter remains available for legacy requests and tests.

The image upload path uses `@wix/media` on the server, accepts JPEG/PNG/WebP/GIF originals up to 10 MB, validates file signatures, and verifies Media Manager readiness before inserting the image block. The draft endpoint rechecks each image descriptor against its upload-token filename prefix, media ID, public flag, URL, and ready state. The Wix Developer Center must have both Media Manager scopes approved before end-to-end uploads work.

The preview renders article blocks and supported formatting in desktop/mobile frames. It does not reproduce the Wix site's global page background, header, footer, theme, or every theme-level rendering rule. Video uploads remain AI visual references and are not embedded as post media in this pass.

Before declaring the feature production-ready, run typecheck/tests/build, approve the new scopes on an isolated Wix development site, verify original GIF rendering and text wrapping in the actual Blog page, and confirm saved SEO/featured/hashtag fields with Wix Blog.

## Validation baseline

Use the scripts that exist in package.json:

- npm run typecheck
- npm test
- npm run build

A passing build or mocked test does not prove that Wix upload permissions, file readiness, animated GIF rendering, or Wix Blog layout work on a live site. Use a non-production Wix development site for end-to-end sign-off.

## Agent handoff

When implementation begins, update this file with only new discoveries and the immediate next step. Put enduring architectural decisions in ARCHITECTURE.md and keep the implementation procedure in AI-WORKFLOW.md.
