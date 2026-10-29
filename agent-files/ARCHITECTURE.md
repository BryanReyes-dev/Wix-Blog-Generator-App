# Wix Blog Generator — Architecture

## Document authority

This is the central architecture document for the repository. It describes current system boundaries and records the intended direction for the requested media-embedding feature. A statement labeled **planned** is not a claim that the code already implements it. Current source and tests determine what is implemented today.

Short-term state, open questions, and agent handoffs belong in agent-files/Agents_Context.md. General coding-agent rules and a map of the documentation set belong in agent-files/AGENTS.md.

## 1. Project boundary

Wix Blog Generator is a Wix CLI/Astro application with a React site widget. It generates, previews, edits, and explicitly saves unpublished Wix Blog drafts for approved site members.

The app uses Wix for member identity, app permissions, managed AI access, Media Manager storage, and Blog draft persistence. The application provides the workflow, server-side validation, content transformation, research-link handling, and approval gate.

## 2. Current repository map

- src/extensions/site/widgets/member-login-test/ — React site-member workflow UI, including research inputs, media-reference inputs, editable article fields, preview, and explicit draft-save action.
- src/extensions/backend/data-collections/workflow-access.ts — app-owned approval collection.
- src/pages/api/workflow/generate.ts — validates the approved member's brief, research links, and visual reference frames; loads research excerpts; calls the article generator; validates output and citation integrity.
- src/pages/api/workflow/drafts.ts — validates draft submissions, verifies the author matches the authenticated member, verifies Wix Blog is installed, converts the article to Ricos, and creates an unpublished draft.
- src/pages/api/workflow-access.ts and src/pages/api/admin/ — approval checks and administrator-facing workflow access.
- src/lib/server/access-control.ts and authorization-related modules — server-side identity and permission enforcement.
- src/lib/server/generate-blog-article.ts — Wix AI-backed article generation and prompt construction.
- src/lib/server/research-sources.ts — public research URL validation, retrieval, excerpt handling, and citation checks.
- src/lib/server/media-references.ts — validation of derived JPEG frames passed to the model as visual context.
- src/lib/server/blog-content.ts — brief/article validation and conversion of edited body text into Wix Ricos nodes.
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

The browser sends the reviewed title, editable article body, description, SEO keywords, submission identity, generating-member identity, and validated research source metadata to POST /api/workflow/drafts.

The server requires an approved member, validates the submitted data, ensures the current member is the one who generated the article, transforms the body into a Ricos document, checks that Wix Blog is installed, and calls the Wix Blog draft API with publish: false. A draft is reported as successful only when Wix confirms an UNPUBLISHED draft ID.

Generation itself does not create a blog item. The application has no publish or scheduling endpoint. The duplicate-submission guard is in-process and is not a durable exactly-once guarantee.

## 6. Current media behavior (implemented)

Media files are currently used as model context only:

- The widget accepts JPEG, PNG, WebP, GIF, and selected video file types.
- Image inputs are normalized to JPEG frames for model analysis.
- Video inputs are represented by a limited set of sampled still frames; audio and unsampled moments are not analyzed.
- The server validates frame counts, JPEG data-URL syntax, names, notes, and aggregate size.
- Original files are not uploaded to Wix Media Manager through this workflow.
- The generated article contract does not return media-placement instructions.
- Ricos conversion currently produces text/list/link-oriented article nodes. It does not add uploaded IMAGE or VIDEO nodes.
- The preview cannot show article media placements because these are not represented in the article model.

This distinction is intentional in the present code: visual reference frames help the model understand the brief, but they are not the assets embedded into the saved post.

## 7. Planned media-embedding flow

### Product requirements

The requested feature must turn selected source files into real article content while keeping analysis derivatives separate. The resulting layout must be readable and responsive, use appropriate media dimensions, maintain heading/list indentation and paragraph spacing, support text flow around aligned media when the destination's Ricos schema permits it, and preserve GIF animation. The local preview and the saved draft must reflect the same media placements.

### Proposed flow (implementation details must be verified)

1. **Retain original assets separately.** Keep each selected browser File and its metadata (name, MIME type, byte size, dimensions, notes) separate from JPEG frames sent to AI. Derivative frames are analysis-only and must never replace the originals.
2. **Upload through Wix Media Manager.** Add a server-authorized upload flow using the supported Wix Media SDK after verifying the exact package, API method, permission scope, upload-size policy, and authorization pattern. Wix documents generated and resumable upload URLs; the signed upload URL should be used for the file transfer rather than embedding base64 file bytes in the article JSON. Files larger than 10 MB may require the resumable flow. Wait until an uploaded file is ready before using it in a draft.
3. **Validate and identify uploaded assets.** Record the returned Wix Media ID and validated metadata in a server/client contract. Do not accept arbitrary file IDs from the model. Validate MIME type, file size, dimensions, and that each placement refers to an asset included in this workflow.
4. **Produce placement metadata.** Extend the validated article representation with a typed placement plan, or use a separate planning step if that is safer. A placement should resolve to an asset and an article location (for example, after an existing section), and contain only supported layout fields plus accessible alt text and an optional caption. Model output is untrusted and must be parsed against the allowed asset IDs and layout options.
5. **Build valid Ricos content.** Extend blog-content.ts to combine heading, paragraph, list, citation, image, and supported video nodes in deliberate order. Ricos media nodes reference Wix Media IDs, and image nodes require intrinsic width/height and descriptive alt text. Add spacer paragraphs where block spacing is needed; do not rely on newlines or arbitrary CSS to create saved-document spacing.
6. **Preserve GIFs.** Upload the original GIF bytes with the original image/gif MIME type and reference the returned Wix Media ID in an IMAGE node. JPEG frames may still be sent to AI for visual analysis, but those frames are not the blog asset. Verify animation on both the development site's preview/rendering path and the saved draft.
7. **Match preview to the saved document.** Render the same placement metadata and sizing/alignment choices in the widget's article preview. Avoid a preview-only layout that cannot be represented in Ricos, because it would mislead the author about the result.
8. **Handle completion and failure safely.** Keep upload and draft-save states distinct. If a file has not finished processing, an upload fails, or placement validation fails, show an actionable error and do not claim the blog draft succeeded.

### Layout and text wrapping

Use the supported Ricos media container properties for width, alignment, caption, and spacing, and verify the exact IMAGE/VIDEO node schema against the current authoring recipe and Wix Blog behavior. The requirement is for appropriately sized media and text flow that respects the selected alignment where supported. Do not implement wrapping with widget CSS alone and imply it will persist in Wix Blog. If Wix Blog's supported IMAGE node cannot preserve floated text wrapping, document that limitation and use a clean, accessible supported layout rather than inserting untrusted raw HTML.

### Permission and API constraints

The current package list does not include @wix/media and current Wix app configuration has not been verified for Media Manager upload permission. Before implementation, confirm the necessary scope and elevated operation from current Wix documentation and the installed app setup. Server-side upload-URL generation must only be available to an authenticated approved member, must validate inputs, and must not expose general-purpose media-management capabilities to the browser.

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
