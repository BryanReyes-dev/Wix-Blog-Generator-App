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
- Uploaded files are currently visual references for the model, not article assets. The client derives JPEG image frames for analysis; videos are represented by sampled still frames. The server accepts only JPEG data URLs for these derived frames. The original file bytes are not uploaded to Wix Media Manager by this workflow, and uploaded media are not persisted as article content.
- The uploader accepts GIF files as image inputs, but its current analysis-frame path normalizes image inputs to JPEG. The animation is therefore not preserved as an embedded article GIF.
- The article model currently returns text fields and sections. src/lib/server/blog-content.ts converts editable body text into Ricos rich-content nodes for paragraphs, headings, lists, quotes, inline emphasis, links, and research citations.
- The draft endpoint creates a draft only after an explicit member action and passes publish: false. The app does not expose a publish or scheduling endpoint.
- The local preview approximates the rendered text and link layout; it does not yet mirror uploaded media placements because media placement is not implemented.

## Current focus: original media embedded in blog drafts

Bryan asked for uploaded media to become actual content inside the generated article, placed where it makes sense, rather than being used only as visual context for the model. The article should preserve useful dimensions and layout, keep heading/list indentation and paragraph spacing clean, support text flowing around aligned media where Wix Blog/Ricos supports it, and preserve animated GIFs.

The requirements apply to both the on-screen preview and the saved Wix Blog draft. The feature should preserve the original file separately from any reduced JPEG frame used as model context.

### Acceptance criteria for the requested feature

1. Supported uploaded images and GIFs are uploaded as original assets to the Wix site's Media Manager. GIFs remain GIFs; a JPEG analysis frame must never replace the uploaded original.
2. The article has explicit, validated placements that associate each asset with a relevant article location or section, rather than appending all media to the bottom by default.
3. Saved Ricos content uses valid Wix Media IDs and complete media metadata such as intrinsic dimensions, alternative text, and optional caption.
4. Media fits the content width without distortion and uses layout/spacing that survives saving to Wix Blog. Text wrapping is implemented only through a supported Wix/Ricos layout property; CSS-only wrapping in the local preview is not sufficient.
5. The live preview displays the original asset and mirrors the intended article placement. Animated GIFs remain animated in the preview and in a saved draft.
6. Uploading or creating a draft fails clearly if an asset is invalid, unavailable, too large, or not ready in Media Manager. A failure must not be reported as a successful draft save.
7. The feature remains behind the existing approved-member server authorization. The client cannot use arbitrary media IDs to embed files it did not upload or is not authorized to use.
8. Tests cover placement validation, rich-content media nodes, dimensions/alt text, GIF MIME/original retention, and upload or readiness failures.

## Implementation notes and unresolved work

- No media-embedding implementation has been added as part of this documentation task. The current behavior remains reference-only until code, tests, permissions, and development-site checks prove otherwise.
- Before selecting exact APIs, read the current Wix Media SDK upload documentation and the Wix Ricos authoring recipe linked in ARCHITECTURE.md. The repository currently does not declare @wix/media in package.json.
- Verify which Wix permission is needed for server-authorized Media Manager uploads and whether auth.elevate is appropriate for each operation. Do not assume app scopes are configured just because source code changes.
- Verify the exact Ricos IMAGE and VIDEO schemas and whether IMAGE nodes can preserve text wrapping in Wix Blog. Prefer supported Ricos layout and block spacing over handcrafted HTML or preview-only CSS.
- Decide and validate a structured media-placement contract before changing the model response shape. Do not trust model-generated IDs or raw HTML; resolve returned placement references only against the server/client-validated asset set.
- The browser keeps selected files session-only today. Do not move file bytes or sensitive content into local storage.

## Validation baseline

Use the scripts that exist in package.json:

- npm run typecheck
- npm test
- npm run build

A passing build or mocked test does not prove that Wix upload permissions, file readiness, animated GIF rendering, or Wix Blog layout work on a live site. Use a non-production Wix development site for end-to-end sign-off.

## Agent handoff

When implementation begins, update this file with only new discoveries and the immediate next step. Put enduring architectural decisions in ARCHITECTURE.md and keep the implementation procedure in AI-WORKFLOW.md.
