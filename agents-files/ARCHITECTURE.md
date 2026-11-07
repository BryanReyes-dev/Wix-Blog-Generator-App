# Wix Blog Generator — architecture

## 1. Application boundary

Wix Blog Generator is a Wix CLI/Astro app with a React custom-element site widget and a dashboard extension. Approved site members can generate, research, edit, preview, and explicitly save unpublished Wix Blog drafts.

Wix provides member identity, permission enforcement, managed AI, Media Manager, and Blog persistence. The app provides the workflow UI, content validation, research URL retrieval, a structured article model, member approval checks, and conversion to Wix Ricos rich content.

## 2. Repository structure

```text
src/
├── extensions.ts
├── extensions/
│   ├── site/widgets/member-login/
│   │   ├── member-login.extension.ts
│   │   ├── member-login.tsx
│   │   ├── member-login.panel.tsx
│   │   ├── blog-workflow.tsx
│   │   ├── types.ts
│   │   ├── components/
│   │   ├── editor/
│   │   ├── hooks/
│   │   └── lib/
│   ├── dashboard/pages/ai-blog-generator/
│   └── backend/data-collections/
├── pages/api/
│   ├── admin/
│   ├── workflow/
│   └── workflow-access.ts
└── lib/
    ├── article-document.ts
    ├── dev-cors.mjs
    └── server/
```

### React widget responsibilities

- **`member-login.tsx`:** Wix custom-element entry point. It mounts/unmounts the React root, determines the current Wix page route, checks member identity and approval, and displays the appropriate login, access, or workflow view.
- **`blog-workflow.tsx`:** top-level workflow composition. It coordinates preferences, visual references, generation requests, and review state. It should not own individual form/card markup or browser media-processing algorithms.
- **`components/`:** reusable visible UI. `ArticleBriefForm` owns the controlled article brief form; `ResearchLinkCard` and `MediaReferenceCard` render individual rows; `WorkflowHeader`, `StatusBanner`, and `AccessPanel` render shared interface sections; `FormField` and `SectionHeading` provide small layout primitives.
- **`editor/`:** the editorial workspace. `ArticleReview` coordinates title, SEO fields, editor/preview state, upload, and explicit draft submission. `ArticleEditor` coordinates editing and reordering; `EditorBlock` renders each block; `AppearancePanel` controls global typography; `ArticlePreview` renders desktop/mobile article previews.
- **`hooks/`:** React state/effect logic reusable by the workflow. `useArticlePreferences` handles member-scoped preferences and research links; `useVisualReferences` handles AI reference file selection and processing state.
- **`lib/`:** ordinary TypeScript helpers that do not need React. These contain limits, class/style tokens, ID generation, local preference storage, authenticated API requests, and image/video frame extraction.
- **`types.ts`:** shared contracts for the workflow. UI components import these instead of redefining the same shapes.

### Astro, Wix, and server responsibilities

- **`src/extensions.ts`:** registers the site widget, dashboard extension, and app-owned collection extension with Wix Astro.
- **`src/pages/api/`:** HTTP route handlers. Routes validate requests, derive context through Wix authentication, call server helpers, and return responses.
- **`src/lib/article-document.ts`:** shared structured article document types, validation, plain-text serialization, and Ricos conversion.
- **`src/lib/server/`:** server-only Wix authorization, access control, Wix AI generation, public research fetching, media reference validation, upload/draft verification, and submission handling.
- **`src/extensions/dashboard/pages/ai-blog-generator/`:** administrator dashboard entry point.
- **`ai-blog-generator/components/`:** React panels for setup checks, status summary, credits, and member access.
- **`ai-blog-generator/hooks/useAdminDashboard.ts`:** dashboard loading, search, paging, and approval state/actions.
- **`ai-blog-generator/lib/admin-api.ts`:** authenticated Wix dashboard API calls.
- **`ai-blog-generator/types.ts`:** dashboard data contracts.
- **`src/extensions/backend/data-collections/`:** app-owned `WorkflowAccess` collection registration and permissions.

Components should render UI; hooks should manage reusable React state; non-React functions should remain ordinary modules; and authentication, permissions, data access, and content creation must remain server enforced.

## 3. Member identity and authorization

1. The site widget uses Wix's member APIs to identify the active site member and start login/logout.
2. The widget calls the workflow-access endpoint through Wix-authenticated HTTP.
3. The server verifies the Wix token and requires a `MEMBER` subject.
4. The member ID is derived from the verified token, not from client-supplied JSON.
5. The server checks the app-owned `WorkflowAccess` collection for an active approval record.
6. Generation and draft creation stop when identity or approval cannot be verified.

Administrative operations use a Wix `USER` identity and their own authorization path. A member session must never gain dashboard privileges merely because it can use the article workflow. The `WorkflowAccess` collection remains app-owned and its item permissions are `PRIVILEGED`.

The server authorization gate is mandatory even when the client hides or redirects a page. Client-side checks are a user-experience feature, not the security boundary.

## 4. Article generation

The current generation flow is:

```text
Brief + optional research links + derived visual reference frames
  → authenticated POST /api/workflow/generate
  → verified MEMBER identity
  → approved-member check
  → public research retrieval and media-frame validation
  → Wix-managed @wix/ai through the Vercel AI SDK
  → structured output validation and citation integrity checks
  → editable article + sources returned to the React widget
```

Research retrieval validates public destinations and redirects, applies time/size limits, and returns bounded excerpts. Page contents and notes are untrusted context, not instructions. Generated citation markers must match source IDs actually retrieved.

Generation-page image references are converted to JPEG frames, and video references are sampled into still frames. These derivatives are provided only as AI visual context; they are not article media.

## 5. Editorial document and preview

`src/lib/article-document.ts` defines the validated `ArticleDocument` shared by editor, preview, and server-side Wix Ricos conversion. Supported blocks are headings, paragraphs, lists, quotes, dividers, and image blocks.

The editor supports typography, colors, text alignment, block backgrounds, vertical padding, image width/alignment, optional text wrapping and borders, alt text, and captions. The preview displays article content and supported settings in desktop/mobile frames. It is not a pixel-identical preview of the entire Wix site: site theme, header, footer, and final Blog template remain controlled by Wix.

## 6. Original article image path

The editor's original image path is separate from AI visual references:

1. An approved member selects a JPEG, PNG, WebP, or GIF file (maximum 10 MB).
2. The server creates a signed Media Manager upload URL after checking the member's identity and approval.
3. The original file is uploaded to Wix Media Manager. GIF bytes are not converted to JPEG.
4. The widget polls the status endpoint until Wix reports the asset ready.
5. The structured image block stores the Wix media ID, upload token, dimensions, accessible alt text, caption, and supported layout settings.
6. At draft creation, the server re-fetches each referenced media descriptor and validates ID, upload token, public URL, MIME type, readiness, and ownership markers before conversion to Ricos image content.

The browser cannot embed an arbitrary external URL or claim an unrelated Wix asset came from this editor.

## 7. Explicit unpublished draft creation

The reviewed article is submitted to `POST /api/workflow/drafts`. The server revalidates the structured document and plain-text checksum, verifies that the active member is the original generating member, checks every embedded image, verifies Wix Blog is installed, and invokes the Wix Blog draft API with `publish: false`.

Only a confirmed `UNPUBLISHED` result is reported as success. Generation by itself does not create a Blog item. The app has no publish or scheduling endpoint. Duplicate-submission protection is in-process and is not a durable exactly-once guarantee across restarts, serverless instances, or uncertain network outcomes.

## 8. Security and reliability invariants

- Trust verified Wix identity, not client-supplied member IDs or role claims.
- Enforce approval on every protected server endpoint.
- Keep admin operations separate from site-member workflow access.
- Treat fetched web content, notes, filenames, and AI-generated output as untrusted input.
- Bound links, files, frame count, encoded payload size, upload size, and generated fields.
- Keep credentials server-side and out of source control and logs.
- Verify image provenance, ownership, and readiness before embedding an asset.
- Preserve original GIF media; do not substitute the derived AI JPEG frame.
- Keep draft saving explicit and unpublished.
- Do not infer live Wix behavior from a passing mock test or successful build.

## 9. Validation boundaries

Automated tests, typechecking, and builds validate code and injected behavior. Manual sign-off on a non-production Wix development site is still required for member/administrator identity, permissions, AI authorization and billing, Media Manager upload readiness, GIF animation, rich-content layout, and successful unpublished draft creation.
