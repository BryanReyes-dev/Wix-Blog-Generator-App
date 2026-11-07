# Wix Blog Generator

A Wix CLI and Astro app that helps approved site members research, generate, edit, preview, and save **unpublished Wix Blog drafts**. The interactive site experience is built with React and TypeScript; Wix provides member authentication, AI access, Media Manager storage, and Blog draft persistence.

## What it does

- Authenticates site members through Wix and checks their approval on protected server routes.
- Generates structured articles with Wix AI from a topic, audience, tone, instructions, and optional SEO keywords.
- Uses up to five public research URLs, with optional focus notes and validated citation markers.
- Accepts up to four visual references. Images are converted to JPEG analysis frames and videos contribute up to three sampled frames each; video audio is not analyzed.
- Provides a block editor for headings, paragraphs, lists, quotes, dividers, and images, with block styling, typography controls, and desktop/mobile previews.
- Uploads original JPEG, PNG, WebP, and GIF article images to Wix Media Manager (up to 10 MB each). GIF originals remain GIFs.
- Saves SEO metadata, tags, and featured state when the member explicitly creates an unpublished draft.

Generation does not create a Blog item. Draft creation happens only after the member selects **Create unpublished draft**, and the server sends `publish: false`. The app does not publish or schedule posts.

## How the project is organized

| Location | Responsibility |
| --- | --- |
| `src/extensions.ts` | Registers the Wix extensions. |
| `src/extensions/site/widgets/member-login/` | Site-member authentication widget and React workflow. |
| `member-login/components/` | Reusable React UI: brief form, cards, status, header, and access panel. |
| `member-login/editor/` | Article block editor, appearance controls, preview, review, and image properties. |
| `member-login/hooks/` | React state and side-effect logic for preferences and visual references. |
| `member-login/lib/` | Browser-side API, preference, media-processing, style, and ID helpers. |
| `src/extensions/dashboard/pages/ai-blog-generator/` | Administrator interface for approval, member access, and AI credit information. |
| `src/extensions/backend/data-collections/` | App-owned workflow access collection. |
| `src/pages/api/` | Astro HTTP endpoints for authentication checks, generation, media, drafts, and admin actions. |
| `src/lib/article-document.ts` | Shared article document validation and conversion to Wix Ricos rich content. |
| `src/lib/server/` | Server-side authorization, Wix AI generation, research retrieval, media verification, and draft helpers. |
| `tests/` | Workflow, authorization, and test-runner checks. |
| `agents-files/` | Maintainer and coding-agent documentation. |

The member widget is registered as the Wix custom element **Member Login** with tag name `member-login`. Place it on `/admin`, `/admin/workflow`, and `/admin/permission-denied`.

## Local development

Use the Node/npm versions declared by the repository's toolchain configuration. From the project root:

```bash
npm install
npm run dev
```

The main validation commands are:

```bash
npm run test:all
npm run typecheck
npm run build
```

When opening the development site through a custom domain, set its exact origin in `WIX_DEV_CORS_ORIGINS` before starting the dev server:

```bash
WIX_DEV_CORS_ORIGINS="https://your-development-domain.example" npm run dev
```

Separate multiple origins with commas. Do not include URL paths or use a wildcard origin. The development CORS policy is configured in `astro.config.mjs` and `src/lib/dev-cors.mjs`; it does not configure production hosting.

## Wix configuration

Configure and approve the relevant permissions in Wix Developer Center:

- **Invoke AI Models** — `SCOPE.DATA_SCIENCE.INVOKE_AI_MODELS`
- **Manage Blog** — `SCOPE.DC-BLOG.MANAGE-BLOG`
- **Manage Media Manager** — `SCOPE.DC-MEDIA.MANAGE-MEDIAMANAGER`
- **Read Media Manager** — `SCOPE.DC-MEDIA.READ-MEDIAMANAGER`
- **Manage Your App** — `SCOPE.DC.MANAGE-YOUR-APP`
- The existing member, data collection, and AI Credits scopes documented in [Wix permissions](agents-files/WIX-PERMISSIONS.md).

Also add **Wix Blog** under **App Profile → App Audience → Required Wix products**, and install Wix Blog on the development site. The app verifies Blog installation again when saving a draft. Approval records live in the app-owned `WorkflowAccess` collection, whose item permissions must remain `PRIVILEGED`.

Article generation uses Wix's managed `@wix/ai` provider with the Vercel AI SDK. `WIX_AI_MODEL` is an optional server-side setting and defaults to `gpt-5-mini`. A standalone `OPENAI_API_KEY` is not required. Verify available AI credits and the applicable billing account on the development site. Wix AI APIs may be Developer Preview and their contracts can change.

## Important behavior and limitations

- Research import supports public HTML and plain-text pages only. It applies URL/redirect checks, a timeout, and a response-size limit.
- Visual references are AI context, not post media. Original article images use a separate Media Manager upload path.
- The preview represents article content and saved rich-text settings. It does not reproduce the Wix site's global theme, header, footer, or exact final Blog template.
- Wix Blog determines final rich-content rendering. Verify image wrapping, GIF animation, typography, and layout on the development site.
- Embedded article video, PDF/document ingestion, general search-engine discovery, publishing, and scheduling are not implemented.
- Automated tests and a successful build do not prove live Wix permissions, AI billing, media processing, or Blog draft creation.

## Documentation

Start with the [documentation index](agents-files/README.md). It links to the architecture, current implementation context, development workflow, authentication sign-off, and Wix permission setup.
