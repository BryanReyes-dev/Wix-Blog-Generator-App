# Wix Blog Generator

A Wix CLI and Astro app that helps approved site members research, generate, edit, preview, and save **unpublished Wix Blog drafts**. The site experience uses React and TypeScript; Wix provides member authentication, AI access, Media Manager storage, and Blog draft persistence.

## What the app does

1. A site member signs in through Wix.
2. The app checks the member's signed Wix identity and looks up their approval in the app-owned `WorkflowAccess` collection.
3. An approved member submits a topic, audience, tone, instructions, optional SEO keywords, research links, and original media.
4. The server retrieves the supplied research pages and asks Wix AI to generate a structured article.
5. Original files are uploaded in their original format to Wix Media Manager. Image and video preview frames can be prepared separately for AI visual context.
6. The member edits the article and reviews source citations, media placements, layout, and SEO metadata.
7. When the member chooses **Create unpublished draft**, the server validates the submission and creates a Wix Blog draft with `publish: false`.

Generation alone does not create a Wix Blog item. The app does not publish or schedule posts automatically.

## Source structure

- `src/components/` contains shared React UI, organized by purpose (`blog`, `dashboard`, `member`, `dev`, and shared `ui`).
- `src/extensions/` contains Wix extension registrations, site-widget code, dashboard code, and the app-owned data-collection schema.
- `src/lib/client/` contains the shared authenticated app-API client.
- `src/lib/hooks/` contains React hooks for member access and workflow state.
- `src/lib/server/` contains server-only Wix integration, authorization, AI generation, research, and draft-submission logic.
- `src/pages/api/` contains the app's HTTP API endpoints.
- `src/pages/dev/` contains development-only UI preview routes.

## Authentication and API requests

Site widgets and dashboard extensions call this app's own HTTP endpoints through the shared `apiFetch()` helper in `src/lib/client/api.ts`. It uses Wix's `httpClient.fetchWithAuth()` and derives the app backend origin from the module URL.

**Production does not use a per-customer-site CORS allowlist.** The app's endpoints are part of the Wix-hosted app backend, and frontend extensions call them using Wix's authenticated-request pattern. Installing the app on another customer site does not require adding that site's domain to CORS configuration.

Local development is different: the widget runs inside a Wix-hosted development-site preview, while `wix dev` serves the app and API from `localhost:4321`. The browser therefore treats the request as cross-origin. The `vite.server.cors` rule in `astro.config.mjs` is a **local development-server setting only**; it permits HTTPS Wix development-preview hostnames ending in `.wixdev-sites.org`. It is not included as a production CORS policy. Do not add individual customer domains or production site domains to this rule.

Keep the Wix authenticated request pattern and enforce access on the server:

- Validate the active Wix token.
- Require a site-member identity for member workflows.
- Check the caller's approval before generation, media operations, or draft creation.
- Require the appropriate privileged Wix user identity for dashboard administration.
- Never trust a member ID supplied by the browser.

Each Wix site installation has its own app data and approval records. Installing the app on another site does not require a new CORS entry, but the new site must be provisioned with the app-owned collection and its own approval records.

## Local UI previews

Run `npm run dev`, then open `/dev` on the local development app:

- `/dev/member-access` — mock sign-in, approved workflow, permission-denied, and unavailable states.
- `/dev/blog-workflow` — complete workflow with mock article generation, editing, and mock draft saving.
- `/dev/blog-brief` — the brief form in isolation.
- `/dev/article-review` — the article editor and metadata in isolation.

The previews use `mode="mock"`. They do not call the live Wix generation or draft APIs and cannot create a real Wix Blog draft. Use the installed development site to validate live Wix authentication, permissions, AI access, media uploads, and Blog draft creation.

## Wix AI and environment variables

Generation uses Wix's managed `@wix/ai` provider rather than a direct OpenAI API key. The optional server-side variable `WIX_AI_MODEL` selects the model and defaults to `gpt-5-mini` when unset. Use a model ID currently supported by Wix AI.

The `.env.example` file documents this optional setting. Configure the shared Wix project variable with the Wix CLI, then pull it for local development:

```bash
npx wix env set --key WIX_AI_MODEL --value gpt-5-mini
npx wix env pull
```

Do not commit `.env.local`, access tokens, or other secrets.

## Wix app setup

Configure and approve the required permissions in Wix Developer Center, including:

- **Invoke AI Models** — `SCOPE.DATA_SCIENCE.INVOKE_AI_MODELS`
- **Manage Media Manager** — `SCOPE.DC-MEDIA.MANAGE-MEDIAMANAGER`
- **Read Media Manager** — `SCOPE.DC-MEDIA.READ-MEDIAMANAGER`
- **Manage Your App** — `SCOPE.DC.MANAGE-YOUR-APP`
- The member, data-collection, Wix Blog, and AI Credits permissions documented in `agents-files/WIX-PERMISSIONS.md`.

Also add **Wix Blog** under **App Profile → App Audience → Required Wix products**, and install Wix Blog on each site that will use the app. The draft API verifies Blog installation before creating a post.

Approval records live in the private app-owned `WorkflowAccess` collection. Its item permissions must remain `PRIVILEGED`. The collection must be provisioned for each app installation.

## Local development and validation

Use the Node/npm versions declared by the repository toolchain configuration. From the project root:

```bash
npm ci
npx wix env pull
npm run dev
```

Open the development app's `/dev` route for isolated UI previews. To validate the application:

```bash
npm run typecheck
npm test
npm run build
```

The test command runs the test runner, authorization, workflow, and UI-preview suites.

## Important behavior and limitations

- Wix AI APIs may be Developer Preview; verify their current availability and behavior in the development app.
- Research URLs are fetched live and validated by the server. HTML and plain-text responses are limited to 5 MiB; text-based PDFs are limited to 5 MiB and 20 pages. The server extracts a bounded article excerpt (up to 6,000 characters) rather than storing the full page. Scanned PDFs that require OCR aren't supported. Retrieved content and source notes are treated as untrusted context, not instructions.
- Images and sampled video frames can inform AI generation. Audio and document/archive contents are not transcribed or parsed by the AI; those files are included as media or download references.
- Uploaded article assets are public Wix Media Manager files so Blog visitors can load them. Do not upload private or sensitive files.
- Wix processes media uploads asynchronously. Draft creation stops with a retryable message until uploaded assets are ready.
- The draft submission guard reduces duplicate attempts but cannot guarantee exactly-once delivery across server restarts or uncertain network failures.
- A successful build or mocked test does not verify live Wix authentication, permission approval, AI credit billing, media processing, or Wix Blog draft creation.
- Source changes do not themselves approve new Wix permission scopes or install Wix Blog on a site.
