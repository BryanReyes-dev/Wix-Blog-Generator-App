# Wix Blog Generator — current context

> Short-term implementation context for the maintainer and coding agents. Keep this concise and current; durable decisions belong in ARCHITECTURE.md.

## Project identity

Wix Blog Generator is a Wix CLI/Astro application with a React site-member widget. Approved Wix site members can generate an article from a brief, optional research links, and optional AI visual references; review and edit it; and explicitly save an unpublished Wix Blog draft.

Wix owns member authentication, app permissions, managed AI access, Media Manager storage, and Blog persistence. The application owns the workflow, validation, research retrieval, structured editor model, and approval gate.

## Current implementation

- Wix custom-element registration is in `src/extensions.ts` and `src/extensions/site/widgets/member-login/`. The display name/tag are **Member Login** / `member-login`; the extension and preset IDs are retained.
- The widget entry point `member-login.tsx` handles Wix member login, route selection, identity/approval checks, and mounting the React workflow.
- `blog-workflow.tsx` composes the brief form, status, header, review experience, and workflow hooks.
- `components/` contains the reusable brief form, research/media cards, header, status banner, access panel, field wrapper, and section heading.
- `editor/` contains article review, block editor, block controls, appearance controls, preview, and editor icons.
- `hooks/useArticlePreferences.ts` manages per-member browser preferences and research-link state.
- `hooks/useVisualReferences.ts` manages generation-page reference files and processing state.
- `lib/` contains widget constants/styles, ID generation, preference storage, the authenticated API client, and browser-side image/video frame extraction.
- `src/lib/article-document.ts` defines and validates the shared structured article document, serializes it, and converts it to Wix Ricos nodes.
- Protected generation and draft endpoints are under `src/pages/api/workflow/`; media upload/status endpoints are nested under `media/`.
- Server-side authorization, Wix AI generation, research retrieval, media verification, and draft logic live under `src/lib/server/`.
- The admin dashboard is registered independently of the member widget. Its `components/` folder contains the setup, summary, credits, and member-access React panels; `hooks/useAdminDashboard.ts` manages dashboard state/actions; `lib/admin-api.ts` wraps authenticated dashboard requests; and `types.ts` contains dashboard data contracts.
- The app-owned `WorkflowAccess` data collection is registered in `src/extensions/backend/data-collections/`.

## Media paths

There are two separate media paths:

1. **AI visual references:** the generation form accepts supported images and videos. Images are converted into JPEG frames; videos are sampled into still frames. These derivatives provide visual context to Wix AI and are not automatically embedded in the article.
2. **Original article images:** the editorial workspace uploads JPEG, PNG, WebP, and GIF originals to Wix Media Manager through server-authorized upload URLs. Each upload is limited to 10 MB. GIF originals remain GIF. The server checks readiness and validates each media reference before saving a draft.

## Current limits and verification

- Up to five research URLs are retrieved with bounded public-page validation.
- Up to four visual reference files and eight total derived frames are accepted by the workflow.
- The editor supports headings, paragraphs, lists, quotes, dividers, and images.
- The preview reflects article content and supported rich-text settings, not the Wix site header, footer, global theme, or exact final page template.
- Draft creation verifies the author, member approval, embedded media, and Wix Blog installation, then uses `publish: false`. There is no publish or scheduling endpoint.
- Wix Developer Center must grant the required Invoke AI Models, Media Manager, Blog, and app-instance scopes. Source changes do not grant permissions or install Wix Blog.
- Automated tests/builds do not prove live Wix AI access, billing identity, Media Manager readiness, GIF rendering, text wrapping, or successful Blog draft creation.

## Immediate handoff

When making the next change, inspect the current branch and working tree first. Keep changes focused, update this file only when current status changes, and put permanent design decisions in ARCHITECTURE.md.
