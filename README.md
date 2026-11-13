# Wix Blog Generator

This Wix CLI/Astro app gives approved site members a basic workflow for generating, reviewing, editing, and explicitly saving unpublished Wix Blog drafts. Wix site-member authentication is reused. The server checks each member's approval before generation or draft creation, validates generated article data, and checks Wix Blog installation before saving a draft.

## Source structure

- `src/components/` contains the React UI, organized by purpose (`blog`, `dashboard`, `member`, and shared `ui`).
- `src/extensions/` contains Wix extension builder definitions, the site-widget custom-element adapter, and the Wix data-collection schema.
- `src/lib/hooks/` contains descriptive React hooks for client-side Wix member access and blog-workflow state/API interactions.
- `src/lib/server/` contains server-only Wix integration, authorization, AI generation, and draft-submission logic.
- `src/lib/blog-content.ts` contains reusable blog types, validation, and content conversion shared by the browser workflow and server routes.
- `src/pages/` keeps Astro file-based routing and the HTTP API endpoints.

React components are kept out of Wix registration files. The site widget's custom-element adapter mounts the shared React UI, while the dashboard page uses the same component-first source organization. CSS Modules live beside the components they style.

## Basic member workflow

1. A member signs in through Wix at `/admin`.
2. The protected `/admin/workflow` page checks the signed-in member and their approval through a server endpoint.
3. The member submits a topic, audience, tone, instructions, and optional SEO keywords.
4. The server calls the Wix AI SDK, then validates the returned article on the server.
5. The member reviews and edits the title and article body.
6. Only after the member selects **Create unpublished draft** does the server check Wix Blog and create a draft with `publish: false`.

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

Configure the app permission scope **Invoke AI Models** (`SCOPE.DATA_SCIENCE.INVOKE_AI_MODELS`) in Wix Developer Center. Keep the existing permissions required for member approvals, member lookup, Wix Blog draft creation, app-instance inspection, and the existing AI Credits dashboard.

Also add **Wix Blog** under **App Profile → App Audience → Required Wix products**. The runtime check compares installed Wix apps against Wix Blog app ID `14bcded7-0066-7c35-14d7-466cb3f09103`; the Developer Center dependency helps prevent installation on sites without Blog, while the runtime check remains the final gate.

Approval records are in the app-owned `WorkflowAccess` collection. The API routes must continue to require an active Wix member identity and an approved member before generation or draft creation. Do not trust client-supplied member IDs.

## Install and validate

After pulling the branch, install dependencies and refresh the npm lockfile:

```sh
npm install
npm run typecheck
npm test
npm run build
```

Then run the app on the Wix development site. Test generation as an approved site member, verify that an unapproved member is rejected, review/edit a generated article, and confirm the final action creates an **unpublished** Wix Blog draft. Confirm the Wix AI model permission and available credits. Verify the owner/installing-user billing behavior before treating the credit requirement as proven.

## Important limitations

- Wix AI APIs are Developer Preview.
- This branch's code changes do not themselves grant the new Wix permission scope or install Wix Blog on the development site.
- A successful build or mocked test does not verify live Wix AI authorization, credit billing identity, or Wix Blog draft creation.
- No app release or production site settings are changed by these source changes.
