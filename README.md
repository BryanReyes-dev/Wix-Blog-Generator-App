# Wix Blog Generator

This Wix CLI/Astro app gives approved site members a basic workflow for generating, reviewing, editing, and explicitly saving unpublished Wix Blog drafts. Wix site-member authentication is reused. The server checks each member's approval before generation or draft creation, validates generated article data, and checks Wix Blog installation before saving a draft.

## Basic member workflow

1. A member signs in through Wix at `/admin`.
2. The protected `/admin/workflow` page checks the signed-in member and their approval through a server endpoint.
3. The member submits a topic, audience, tone, instructions, and optional SEO keywords.
4. The server calls the Wix AI SDK, then validates the returned article on the server.
5. Members can optionally paste up to five public webpage URLs. The server checks the destination, retrieves a bounded HTML or plain-text excerpt, and passes those excerpts to Wix AI as untrusted research material.
6. The server checks generated citation markers against the retrieved source IDs, and the editor shows the source URLs alongside a live, visitor-style article preview.
7. The member reviews and edits the title and article body.
8. Only after the member selects **Create unpublished draft** does the server check Wix Blog and create a draft with `publish: false`.

Generation alone never creates a Wix Blog item. There is no publish or scheduling endpoint. The draft submission guard reduces duplicate attempts but does not guarantee exactly-once delivery across server restarts or uncertain network failures.

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

### Local development CORS

The site widget calls the local Astro server from a Wix-hosted page, so those requests are cross-origin during `wix dev`. The dev server allows localhost and HTTPS origins under Wix-managed `wix.com`, `wixsite.com`, `wixstudio.io`, and `wix.run` domains, plus Wix development preview hosts matching `https://dev-<site-id>.wixdev-sites.org`. If the development site is being viewed through another custom domain, set its exact origin when starting the dev server:

```sh
WIX_DEV_CORS_ORIGINS="https://your-development-domain.example" npm run dev
```

Separate multiple exact origins with commas. Do not include URL paths, and do not set Vite CORS to allow every origin. These CORS rules apply to the local Vite dev server only, not production hosting.

## Research links and article preview

Research-link import currently accepts up to five URLs to public HTML or plain-text pages. It rejects IP-literal and local/private destinations, rechecks redirects, applies a ten-second fetch timeout and a one-megabyte response cap, and provides source IDs for inline citations. Generated source markers are mapped to Ricos link decorations when saving a draft. Webpage excerpts are untrusted content; the generation prompt instructs the model to treat them as research rather than instructions.

The preview is a local approximation of the article's headings, paragraphs, lists, citations, and links. Wix's published blog theme still controls final presentation. General search-engine discovery, PDF/document ingestion, and media uploads are not implemented in this slice; contributors must paste public webpage URLs.

## Important limitations

- Wix AI APIs are Developer Preview.
- This branch's code changes do not themselves grant the new Wix permission scope or install Wix Blog on the development site.
- A successful build or mocked test does not verify live Wix AI authorization, credit billing identity, or Wix Blog draft creation.
- No app release or production site settings are changed by these source changes.
