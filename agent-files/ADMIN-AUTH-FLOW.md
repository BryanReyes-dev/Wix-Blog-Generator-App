# Authentication, authorization, and manual sign-off

## Identity boundaries

- Wix owns site-member login and logout. The widget uses `currentMember.getMember()`, `authentication.promptLogin()`, and `authentication.logout()` for the existing member flow.
- Server endpoints trust only the active Wix token returned by `auth.getTokenInfo()`. A workflow call must have subject type `MEMBER`; an administrative call must have subject type `USER`.
- Workflow approval is checked on the server for generation and draft creation. The member ID is taken from the verified token. Any `memberId` in an article request is ignored.
- Admin routes additionally make a non-elevated read against `WorkflowAccess`. The collection grants item access only to `PRIVILEGED` Wix users. Admin member lookup, credit inspection, and approval changes are not elevated, so Wix can enforce the dashboard user's own permissions.
- The approval lookup used for a site member is elevated only after the caller has been identified as a member. It filters by that token's member ID and returns only an approval result.
- `WorkflowAccess` is an app-owned per-site collection with all item actions set to `PRIVILEGED`. Direct frontend collection access cannot grant or read approvals for members or ordinary CMS editors.
- Draft creation is elevated in backend code only after the server has verified the member and approval. It sets `memberId` to the verified caller, checks Wix Blog installation, and passes `publish: false`.

## Automated checks

Run `npm test`. The Node built-in tests cover signed-out and expired tokens, approved and unapproved members, an unavailable approval lookup, member versus dashboard-user identity, privileged access, input and generated-article validation, client-supplied identity being ignored by draft parsing, Ricos content construction, in-process duplicate-submission suppression, OpenAI structured output parsing, missing provider configuration, and malformed provider output.

These are unit tests with injected Wix/OpenAI boundaries. They do not prove Wix token verification, Wix role enforcement, app scopes, installed-app behavior, or a live Blog API call. Those need the development-site checks below.

## Development-site sign-off

Use a non-production Wix development site. Before testing, configure the permissions and Wix Blog required product in Developer Center, provision the app's data collection, set the server-side OpenAI key, place the member widget on the three `/admin` pages, and resize the `/admin/workflow` placement wide and tall enough to show its form and review panel. Existing placements may retain their previous dimensions.

For direct API checks, use the browser's Network panel on the development site. Capture a request made by the app, then replay it with the same Wix-authenticated context while changing the request body. This bypasses page navigation and tests the server route itself. Do not paste Wix tokens into chat or save them in the repository.

| Case | Action | Expected result |
| --- | --- | --- |
| Signed-out visitor | Open `/admin/workflow`. Replay `POST /api/workflow/generate` and `POST /api/workflow/drafts` without a Wix member session. | The page returns to `/admin`; both endpoints deny the request (401). No OpenAI call or Blog draft is made. |
| Authenticated, unapproved member | Sign in with a member absent from `WorkflowAccess`. Open the workflow, then replay the two POST requests directly from Network. | The workflow redirects to `/admin/permission-denied`; both server operations return 403. |
| Approved member | Grant approval from the dashboard using an administrator, then sign in as that member. | The member can open `/admin/workflow` and generate a structured article. Generation creates no Blog item. |
| Approved member attempts admin actions | From the approved member session, replay `GET /api/admin/members`, `GET /api/admin/credits`, and `POST /api/admin/workflow-access`. | Each request returns 403 because a site-member token is not a Wix dashboard-user token. No approval or dashboard data changes. |
| Authorized administrator | Sign in to the Wix dashboard as the site owner or a collaborator with Wix `PRIVILEGED` access and required API permissions. | Member directory and credit balance load. The administrator can grant/revoke approval. The collection record reflects that user's Wix identity in `grantedBy`. |
| Missing approval record | Sign in as a valid site member with no matching approval row. | Approval returns false; generation and draft creation return 403. |
| Unavailable approval service | On an isolated development site, make the app-owned collection unavailable or remove its read permission, then request the workflow APIs. | The page reports that access cannot be verified; protected operations return an error and create neither generated output nor a draft. Access stays blocked. Restore collection access after the check. |
| Forged or mismatched member ID | As an approved member, replay generation and draft POST requests with a different `memberId` in JSON. | The server still checks the signed-in caller. If approved, any resulting draft's `memberId` is the caller from the Wix token, not the forged value. |
| Direct API navigation bypass | Replay the protected generation/draft requests directly without navigating through `/admin/workflow`. | Authorization is unchanged; the route itself enforces member identity and approval. A hidden page is not the gate. |
| Failed or unauthorized draft | Replay draft creation as signed-out, unapproved, or approved-but-not-admin member. | The request is denied before Wix Blog's create method is called. No draft is created. |
| Wix Blog missing | Use a development site without Wix Blog and submit a reviewed draft. | The app-instance check returns 409 with an install instruction. The draft API is not called. |
| Blog installed but installation check unavailable | Keep Blog installed but remove the app's `Manage Your App` scope, then submit a draft. | The app-instance check returns 503 and stops before draft creation. |
| Blog installed but draft permission unavailable | Restore `Manage Your App`, keep Wix Blog installed, remove `Manage Blog`, and submit a draft. | Wix rejects creation; the interface shows an actionable permission error and reports no success. If a request times out, inspect Blog before retrying because its outcome may be unknown. |
| Successful explicit draft save | Restore both scopes, configure OpenAI, approve a test member, generate content, edit the title/body, and click **Create unpublished draft**. | UI confirms a draft ID and `UNPUBLISHED`. No draft exists before the explicit click. |
| Confirm draft is unpublished | Open Wix Blog's draft list on the development site and find the returned ID. | The article appears as an unpublished draft, has the test member as its author, and is absent from published posts. The app has no publish endpoint. |

The in-process duplicate guard shares an in-flight or successful request for the same member and submission ID on one warm server instance. It is not durable across deployments, server restarts, or separate instances. If the API response is uncertain, check Wix Blog before retrying.
