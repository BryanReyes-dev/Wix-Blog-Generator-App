# Wix Blog Generator — Architecture

## Document authority

This is the central architecture document for the repository. It describes current system boundaries and records the intended direction for the requested media-embedding feature. A statement labeled **planned** is not a claim that the code already implements it. Current source and tests determine what is implemented today.

Short-term state, open questions, and agent handoffs belong in agent-files/Agents_Context.md. General coding-agent rules and a map of the documentation set belong in agent-files/AGENTS.md.

## 1. Project boundary

Wix Blog Generator is a Wix CLI/Astro application with a React site widget. It generates, previews, edits, and explicitly saves unpublished Wix Blog drafts for approved site members.

The app uses Wix for member identity, app permissions, managed AI access, Media Manager storage, and Blog draft persistence. The application provides the workflow, server-side validation, content transformation, research-link handling, and approval gate.

## 2. Current repository map

- src/extensions/site/widgets/member-login-test/ — React site-member workflow UI, including research inputs, AI visual references, and the editorial workspace.
- src/extensions/site/widgets/member-login-test/editor/ — reusable article block editor, appearance controls, review orchestration, preview, and icon components.
- src/lib/article-document.ts — shared structured article model, validation, plain-text serialization, and Ricos conversion.
- src/pages/api/workflow/media/ — approved-member Media Manager upload and readiness endpoints.
- src/extensions/backend/data-collections/workflow-access.ts — app-owned approval collection.
- src/pages/api/workflow/generate.ts — validates the approved member's brief, research links, and visual reference frames; loads research excerpts; calls the article generator; validates output and citation integrity.
- src/pages/api/workflow/drafts.ts — validates draft submissions and structured article documents, verifies the author and every referenced media upload, verifies Wix Blog is installed, and creates an unpublished draft.
- src/pages/api/workflow-access.ts and src/pages/api/admin/ — approval checks and administrator-facing workflow access.
- src/lib/server/access-control.ts and authorization-related modules — server-side identity and permission enforcement.
- src/lib/server/generate-blog-article.ts — Wix AI-backed article generation and prompt construction.
- src/lib/server/research-sources.ts — public research URL validation, retrieval, excerpt handling, and citation checks.
- src/lib/server/media-references.ts — validation of derived JPEG frames passed to the model as visual context.
- src/lib/server/blog-content.ts — brief/article validation, legacy editable-body conversion, and SEO/tag/featured field validation.
- agent-files/ — human/agent documentation, current context, architecture, workflow, permissions, and manual validation.

## 3. Request and authorization boundaries

A normal member workflow follows this sequence:

1. The browser obtains its Wix-managed member session and calls the application API using Wix's authenticated request mechanism.
2. The server verifies the token and requires a MEMBER identity.
3. The server derives the member ID from verified identity; it does not trust a client-supplied ID.
4. The server checks that the member has an approved record in the app-owned WorkflowAccess collection.
5. Only then does generation or draft creation proceed.

Administrative approval and dashboard operations use their own authorized Wix USER context and must not be granted to a site-member session simply because that member can generate content.

The server authorization gate is mandatory even when the UI hides or redirects a page. A client-side check is convenience, not the security boundary.

## 4. Current article-generation flow

The current generation path is:

Member brief + optional research links + derived visual reference frames
→ authenticated POST /api/workflow/generate
→ approved-member authorization
→ research retrieval and frame/schema validation
→ Wix AI generation
→ article schema and citation validation
→ editable article + source metadata returned to the widget
→ local review and visitor-style preview.

Research excerpts are untrusted page content, not executable instructions. The server validates fetched URLs and redirects and constrains content size. Generated citation identifiers are checked against the sources actually supplied to the model.

The AI provider is the Wix-managed @wix/ai integration used with the Vercel AI SDK. WIX_AI_MODEL configures the model and defaults to gpt-5-mini. The current workflow does not require a standalone OPENAI_API_KEY. Confirm the current Developer Center Invoke AI Models scope and Wix AI credit behavior on the development site.

## 5. Current draft-save flow

The browser sends the reviewed title, structured article document, plain-text checksum, description, SEO settings, tags, featured flag, submission identity, generating-member identity, and validated research source metadata to POST /api/workflow/drafts.

The server requires an approved member, validates the submitted document and plain-text checksum, ensures the current member is the one who generated the article, verifies every embedded image against its Wix Media Manager descriptor and upload-token prefix, checks that Wix Blog is installed, and calls the Wix Blog draft API with publish: false. A draft is reported as successful only when Wix confirms an UNPUBLISHED draft ID. Legacy requests without a structured document continue through the previous Markdown-to-Ricos converter.

Generation itself does not create a blog item. The application has no publish or scheduling endpoint. The duplicate-submission guard is in-process and is not a durable exactly-once guarantee.

## 6. Editorial workspace, media, and preview (implemented)

The repository has two separate media paths:

- **AI visual references:** The generation form accepts JPEG, PNG, WebP, GIF, and selected video files. Images are normalized to JPEG frames and videos are sampled into still frames for model context. These references are not automatically embedded in the article.
- **Original article media:** The editorial workspace lets an approved member insert JPEG, PNG, WebP, and GIF files directly into an article. The server generates a signed Wix Media Manager upload URL, validates the binary signature and a 10 MB size limit, uploads the original bytes, and polls the file descriptor until Wix reports `READY`. GIF originals remain GIFs.

The editorial workspace uses one validated, typed `ArticleDocument` shared by the block editor, preview, and server-side Wix Ricos converter. The document supports headings, paragraphs, lists, quotes, dividers, and image blocks. Each image block carries the Wix Media ID, verified upload-token marker, dimensions, required alternative text, optional caption, width, alignment, text wrapping, and border settings.

Typography controls support font families, sizes, text colors, heading colors, alignment, and line spacing. Block styling supports text/background colors and vertical padding. The preview displays the same article content and editor settings in desktop and mobile frames.

The preview is an article-content preview, not a pixel-perfect preview of the entire Wix site. It does not reproduce the site's header, footer, Blog theme, site-wide background, or every theme-specific responsive behavior. The development site remains the final verification environment. Embedded video, arbitrary HTML/CSS, unrestricted website-theme editing, and drag-and-drop canvas positioning are not part of this implementation.

## 7. Upload and draft-save validation

Both media endpoints require an approved Wix member. The upload route keeps the signed URL server-side and accepts only JPEG, PNG, WebP, or GIF originals. The status route verifies the UUID upload token in the Media Manager display name and returns only a ready, public Wix-hosted image URL.

During draft creation, the server re-fetches each unique referenced media descriptor and checks its ID, upload-token prefix, public status, Wix URL, media type, ready state, and non-deleted state. The browser cannot submit an arbitrary external URL as a media block or claim an unrelated site image was uploaded through this editor. Both Media Manager scopes must be granted by the app owner before this works on the development site.

## 8. Security and reliability principles

- Trust verified Wix identity, not client-supplied member IDs or claimed roles.
- Enforce approval on each protected server endpoint.
- Treat fetched web content, user notes, file names, and AI-generated placement data as untrusted input.
- Bound request bodies, number of links, number of files, frames, upload sizes, and all generated fields.
- Keep secrets server-side and out of source control and logs.
- Keep draft creation explicit and unpublished by default.
- Never log article bodies, secrets, or uploaded file content for routine diagnostics.
- Do not claim live Wix behavior from a unit test or successful build alone.

## 9. Authoritative references

- [Wix Ricos rich-content authoring recipe](https://github.com/wix/skills/blob/main/skills/wix-manage/references/rich-content/author-ricos-rich-content.md) — canonical reference for constructing valid Ricos nodes, including image/video nodes, nesting, captions, and spacer paragraphs.
- [Wix Media Manager: Generate File Upload URL](https://dev.wix.com/docs/api-reference/assets/media/media-manager/files/generate-file-upload-url?apiView=SDK) — signed Media Manager upload flow.
- [Wix Media Manager: Generate File Resumable Upload URL](https://dev.wix.com/docs/api-reference/assets/media/media-manager/files/generate-file-resumable-upload-url?apiView=SDK) — resumable upload flow for larger files.
- [Wix rich-content / Ricos introduction](https://dev.wix.com/docs/api-reference/assets/rich-content/ricos-documents/introduction?apiView=SDK) — Ricos document overview.

## 10. Validation

The automated project baseline is:

- npm run typecheck
- npm test
- npm run build

Manual validation on a non-production Wix development site is required for approved/unapproved member behavior, Wix AI scope, Media Manager upload permissions and readiness, GIF animation, media wrapping/layout persistence, and successful unpublished draft creation.
