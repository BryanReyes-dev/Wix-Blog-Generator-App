# Wix Blog Generator

This Wix CLI/Astro app gives approved site members a small workflow for drafting blog articles. Wix site-member authentication is reused. The server checks each member's approval before generation or draft creation, and checks Wix Blog installation before it saves a draft.

## Member workflow

1. A member signs in through Wix at `/admin`.
2. The protected `/admin/workflow` page checks the signed-in member and their approval through a server endpoint.
3. The member submits a topic, audience, tone, instructions, and optional SEO keywords. The server calls OpenAI's Responses API with a strict JSON schema and validates the returned article.
4. The member reviews the title and article body, can edit both, and chooses **Create unpublished draft**.
5. The server checks Wix Blog through the app's `getAppInstance()` response. If Wix Blog is absent or cannot be verified, it stops before calling the draft API.
6. The server calls Wix Blog `createDraftPost` with `publish: false`, assigns the verified caller's site-member ID, and returns the draft ID and unpublished status.

Generation alone never creates a Wix Blog item. There is no publish or scheduling endpoint. A short-lived in-process submission guard and a disabled submit button reduce duplicate attempts; they do not provide durable exactly-once delivery across server restarts or uncertain network failures.

The dashboard remains the administrative surface for member approvals and AI credit inspection. Wix AI Credits provides a balance only; it is not used as the text-generation provider.

## Configuration

Copy the variable names from [.env.example](./.env.example). Set `OPENAI_API_KEY` as a server-only Wix CLI secret variable. Set `OPENAI_MODEL` to override the default `gpt-5.4-mini` model.

For Wix CLI projects, use `wix env set` to store secret server variables on Wix. Use `wix env pull` to make them available to local development; pulled values go into `.env.local`, which is ignored by Git. Never use a `PUBLIC_` prefix for the key.

OpenAI usage is billed separately from Wix AI credits. Article briefs are sent to the configured OpenAI API account for generation.

## Wix setup

Configure these app permissions in Wix Developer Center:

| Scope | Used for |
| --- | --- |
| `SCOPE.DC-BLOG.MANAGE-BLOG` — Manage Blog | Create an unpublished Wix Blog draft. |
| `SCOPE.DC.MANAGE-YOUR-APP` — Manage Your App | Call Get App Instance and inspect installed Wix app IDs before draft creation. |
| `SCOPE.DC-MEMBERS.READ-MEMBERS` — Read Members | Read the member directory in the administrative dashboard. |
| `SCOPE.PROMOTE.MANAGE-SEO` — Manage SEO Settings | Preserve the existing Wix AI Credits balance inspection. |
| `SCOPE.DC-DATA.READ` — Read Data Items | Read member approvals and verify privileged dashboard access. |
| `SCOPE.DC-DATA.WRITE` — Write Data Items | Save and revoke member approvals. |

Also add **Wix Blog** under **App Profile → App Audience → Required Wix products**. The runtime check compares the `site.installedWixApps` list against Wix Blog app ID `14bcded7-0066-7c35-14d7-466cb3f09103`. The Developer Center dependency helps block installation on sites without Blog; the runtime check remains the final gate.

Approval records are in the app-owned `WorkflowAccess` collection. All four item permissions are `PRIVILEGED`, which blocks site members and ordinary CMS editors from reading or changing approvals directly. The admin endpoints also require an active Wix `USER` token and a non-elevated read against that collection. Admin member and credit calls remain non-elevated so Wix can enforce the dashboard user's own permissions.

The collection permission change and app scopes must be provisioned on an isolated development site before live testing. No release or site setting was changed as part of this implementation.

## Validation

Run:

```sh
npm run typecheck
npm test
npm run build
```

The tests use Node's built-in test runner and mocks for the OpenAI and Wix boundaries. They do not prove that Wix authentication, app permissions, Blog installation, or live draft creation work. Use [ADMIN-AUTH-FLOW.md](./agent-files/ADMIN-AUTH-FLOW.md) for the manual sign-off sequence.
