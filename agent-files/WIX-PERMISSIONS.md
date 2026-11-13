# Wix permissions and setup

The app keeps Wix-managed member sign-in. Site widgets use Wix's current member API for navigation and sign-in, while server endpoints verify the request token with `auth.getTokenInfo()`. Member IDs come from the verified `MEMBER` token, never from a request body.

## Wix Developer Center permissions

Request only the scopes needed by the current implementation:

| Scope | Purpose |
| --- | --- |
| `SCOPE.DATA_SCIENCE.INVOKE_AI_MODELS` — Invoke AI Models | Required for article generation through the Wix-managed `@wix/ai` provider. Wix handles provider authentication and AI usage billing. |
| `SCOPE.DC-BLOG.MANAGE-BLOG` — Manage Blog | Create a Wix Blog draft. The request explicitly sends `publish: false`. |
| `SCOPE.DC-MEDIA.MANAGE-MEDIAMANAGER` — Manage Media Manager | Generate signed direct and resumable upload URLs so approved members can upload original article media. |
| `SCOPE.DC-MEDIA.READ-MEDIAMANAGER` — Read Media Manager | Verify uploaded files, media types, processing state, and URLs before adding them to the Blog draft. |
| `SCOPE.DC.MANAGE-YOUR-APP` — Manage Your App | Call `appInstances.getAppInstance()` as the app and verify Wix Blog's installed app ID. |
| `SCOPE.DC-MEMBERS.READ-MEMBERS` — Read Members | Read the live member directory for the dashboard. Calls are made without elevation, so Wix also evaluates the dashboard user's role. |
| `SCOPE.PROMOTE.MANAGE-SEO` — Manage SEO Settings | Keep the existing AI Credits balance inspection working. It does not generate content. |
| `SCOPE.DC-DATA.READ` — Read Data Items | Check approval records. The member-facing server check uses app elevation after deriving the member ID from the signed Wix token. |
| `SCOPE.DC-DATA.WRITE` — Write Data Items | Save and revoke approvals. The admin write is not elevated; the collection's `PRIVILEGED` permission and dashboard identity both apply. |

Wix's current Get Balance docs map the existing credit read to Manage SEO Settings. Verify that permission in Developer Center for this app version; do not substitute another Wix scope based on its name.

## Wix Blog dependency and runtime check

In Wix Developer Center, add **Wix Blog** in **App Profile → App Audience → Required Wix products**. The Wix app dependency is a Developer Center setting, not a field in this project's `wix.config.json`.

At draft submission time, the backend calls `appInstances.getAppInstance()` and checks `site.installedWixApps` for Wix Blog app ID `14bcded7-0066-7c35-14d7-466cb3f09103`. That identifier was verified from the connected Wix site app context. If the list is missing, Blog is absent, or the `Manage Your App` call fails, the endpoint stops before `createDraftPost` and returns an actionable error.

Original media is uploaded to Wix Media Manager through `@wix/media`. Files up to 10 MB use a signed direct upload URL; larger files use Wix's resumable TUS upload URL. The server re-reads each uploaded descriptor, verifies its Wix media type and public URL, and waits for `operationStatus === 'READY'` before composing the draft. Upload URL generation requires Manage Media Manager; descriptor verification requires Read Media Manager.

The creation path uses `draftPosts.createDraftPost()` from `@wix/blog`, sends the verified site-member ID as the required third-party `memberId`, and passes `{ publish: false }`. Original images are inserted as IMAGE blocks, videos as VIDEO blocks, audio as AUDIO blocks, and document/archive assets as downloadable links. Only a returned `UNPUBLISHED` status is reported as success. The app has no publish call.

## Approval collection and authorization

`WorkflowAccess` remains app-owned and site-specific. Its `itemRead`, `itemInsert`, `itemUpdate`, and `itemRemove` access levels are all `PRIVILEGED`, so a site member or ordinary CMS editor cannot grant themselves access through a direct collection call.

Member workflow endpoints require an active `MEMBER` token and a successful approval lookup for the member ID from that token. A missing record denies access; an approval-service error returns a blocked response. Dashboard administration requires an active `USER` token and a successful non-elevated read against the `PRIVILEGED` collection. The member directory, credit balance, and approval mutation SDK calls are not elevated, so Wix's user role and the app's granted scopes both remain in force.

On an already-installed app, changes to a data collection extension or new app scopes require the appropriate Wix app version/update and site approval before they work on the development site. This code change does not release the app or alter site settings.

## Wix AI configuration

Article generation uses the Wix-managed `@wix/ai` provider with the Vercel AI SDK. It does not call OpenAI directly and does not require an `OPENAI_API_KEY`.

- Required app scope: `SCOPE.DATA_SCIENCE.INVOKE_AI_MODELS` — **Invoke AI Models**.
- Optional server variable: `WIX_AI_MODEL`; the app defaults to `gpt-5-mini`.
- Wix AI APIs are documented as Developer Preview. Confirm that the installing Wix user can access AI model usage and that the model ID is supported by Wix.

Use `wix env set` only when changing the optional `WIX_AI_MODEL` setting. Do not add an OpenAI API key for this Wix-managed integration. For local development, `wix env pull` refreshes the project's Wix environment variables into `.env.local`.

## Development-site setup still required

Before live verification:

1. Add the Wix Blog required product in Developer Center.
2. Add all Wix permissions listed above, especially Invoke AI Models, Manage Media Manager, and Read Media Manager; then approve the app update on the development site.
3. Install Wix Blog on that development site and ensure the app-owned `WorkflowAccess` collection is provisioned with `PRIVILEGED` permissions.
4. Confirm the installing Wix user has AI model availability; optionally set `WIX_AI_MODEL` to a model ID supported by Wix.
5. Place the member widget on `/admin`, `/admin/workflow`, and `/admin/permission-denied`. On `/admin/workflow`, stretch it wide and increase its height to show the brief and review fields; existing placements may retain their previous dimensions.
6. Run `wix dev` and follow the manual sign-off cases in [ADMIN-AUTH-FLOW.md](./ADMIN-AUTH-FLOW.md).

The connected development site did not have Wix Blog installed when this code was inspected. No app release, Blog installation, production read, or production setting change was performed.
