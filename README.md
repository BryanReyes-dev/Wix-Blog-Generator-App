# Wix Blog Generator

A Wix CLI and Astro app that helps approved site members research, generate, edit, preview, and save **unpublished Wix Blog drafts**. The interactive site experience is built with React and TypeScript; Wix provides member authentication, AI access, Media Manager storage, and Blog draft persistence.

<<<<<<< HEAD
## Source structure

- `src/components/` contains the React UI, organized by purpose (`blog`, `dashboard`, `member`, and shared `ui`).
- `src/extensions/` contains Wix extension builder definitions, the site-widget custom-element adapter, and the Wix data-collection schema.
- `src/lib/hooks/` contains descriptive React hooks for client-side Wix member access and blog-workflow state/API interactions.
- `src/lib/server/` contains server-only Wix integration, authorization, AI generation, and draft-submission logic.
- `src/lib/blog-content.ts` contains reusable blog types, validation, media placement, and Wix rich-content conversion shared by the browser workflow and server routes.
- `src/lib/media-file-types.ts` maps supported upload extensions to Wix Media Manager types; `src/lib/media-upload.ts` uploads the original file; `src/lib/media-reference.ts` prepares separate JPEG frames for AI-only visual analysis.
- `src/pages/` keeps Astro file-based routing and the HTTP API endpoints.

The editorial review layout is an original implementation informed by the publication hierarchy of [Revista](https://github.com/chrisnmorrison/revista-gatsby-blog-magazine), an MIT-licensed React/Gatsby blog and magazine template. No Revista source files or assets are copied into this project.

React components are kept out of Wix registration files. The site widget's custom-element adapter mounts the shared React UI, while the dashboard page uses the same component-first source organization. CSS Modules live beside the components they style.

## Basic member workflow

1. A member signs in through Wix at `/admin`.
2. The protected `/admin/workflow` page checks the signed-in member and their approval through a server endpoint.
3. The member submits a topic, audience, tone, instructions, and optional SEO keywords.
4. The server calls the Wix AI SDK, then validates the returned article on the server.
5. Original files are uploaded in their original format to Wix Media Manager. Image/video previews may be converted into JPEG frames for AI analysis; the original binary stays unchanged.
6. The member reviews the headline and article copy, then adjusts each media file's section, position, caption, and image alt text in the editorial preview.
7. Only after the member selects **Create unpublished draft** does the server re-verify uploaded media descriptors, build Wix rich-content media blocks, check Wix Blog, and create a draft with `publish: false`.

Generation alone never creates a Wix Blog item. There is no publish or scheduling endpoint. The draft submission guard reduces duplicate attempts but does not guarantee exactly-once delivery across server restarts or uncertain network failures.

## Local UI previews

Run `npm run dev`, then open `/dev` on the local development server. These preview routes are development-only and redirect to the home page outside development:

- `/dev/member-access` — mock sign-in, approved workflow, permission-denied, and access-unavailable screens.
- `/dev/blog-workflow` — complete workflow, including mock article generation, article editing, and mock draft saving.
- `/dev/blog-brief` — the brief form in isolation.
- `/dev/article-review` — the article editor and metadata in isolation.

The preview passes `mode="mock"` to the workflow hook. It does not call the Wix generation or draft API and cannot create a real Wix Blog draft. Use the normal Wix member flow to verify live authorization and Wix integration.

Run the UI-preview suite with `npm run test:preview`. Run it together with the existing runner, authorization, and workflow suites using `npm test`.

## Wix AI and packages

Generation uses the Wix AI SDK rather than a direct OpenAI API key. Wix handles AI provider authentication and billing for Wix apps. The AI APIs are currently documented as **Developer Preview**, so their behavior and SDK contracts may change.

Required packages are included in `package.json`:

- `@wix/ai` — Wix-managed AI provider.
- `ai` (version 6.0.26 or later) — Vercel AI SDK methods used by Wix AI.
- `zod` (version 4.1.8 or later) — included as recommended by Wix's SDK setup instructions.

No `OPENAI_API_KEY` is required. Optional server-side variable `WIX_AI_MODEL` defaults to `gpt-5-mini`; use a model ID supported by Wix AI. Wix's documentation notes that AI model calls consume AI credits and that usage for a Wix app is billed to the Wix users who install the app. Verify the actual wallet and billing behavior on the development site before inviting contributors; a credit-balance display alone does not prove which wallet a generation request consumes.

For Wix CLI projects, use `wix env set` to configure server variables and `wix env pull` to make them available in local development. Never put secrets in public/client variables. This integration does not require a separate OpenAI API key.

## Wix setup

Configure the app permission scope **Invoke AI Models** (`SCOPE.DATA_SCIENCE.INVOKE_AI_MODELS`) in Wix Developer Center. Also grant **Manage Media Manager** (`SCOPE.DC-MEDIA.MANAGE-MEDIAMANAGER`) and **Read Media Manager** (`SCOPE.DC-MEDIA.READ-MEDIAMANAGER`) for original file uploads and upload verification. Keep the existing permissions required for member approvals, member lookup, Wix Blog draft creation, app-instance inspection, and the existing AI Credits dashboard.

Also add **Wix Blog** under **App Profile → App Audience → Required Wix products**. The runtime check compares installed Wix apps against Wix Blog app ID `14bcded7-0066-7c35-14d7-466cb3f09103`; the Developer Center dependency helps prevent installation on sites without Blog, while the runtime check remains the final gate.

Approval records are in the app-owned `WorkflowAccess` collection. The API routes must continue to require an active Wix member identity and an approved member before generation or draft creation. Do not trust client-supplied member IDs.

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

- Wix AI APIs are Developer Preview.
- Original media uploads are currently whitelisted in `src/lib/media-file-types.ts`: common image, video, audio, document, and archive extensions. The app caps images at 50 MB (GIF at 15 MB), SVG at 250 KB, audio/documents/archives at 100 MB, and videos at 15 GB; Wix's own limits and accepted formats remain authoritative. Large files use resumable upload.
- Images and sampled video frames can inform AI generation. Audio and document/archive contents are not transcribed or parsed by the AI; audio is embedded as a player and documents/archives as download links.
- Uploaded article assets are public Wix Media Manager files so public Blog visitors can load them. Do not attach private or sensitive files.
- Wix processes uploads asynchronously. Draft creation stops with a retryable message until every uploaded asset is READY in Media Manager.
- This branch's code changes do not themselves grant the new Wix permission scope or install Wix Blog on the development site.
- A successful build or mocked test does not verify live Wix AI authorization, credit billing identity, or Wix Blog draft creation.
- No app release or production site settings are changed by these source changes.
