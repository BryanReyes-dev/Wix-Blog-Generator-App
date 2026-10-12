# Wix permissions and setup for AI Blog Generator

This branch adds the code foundation for live member access and the Wix AI Credits balance. The code does not grant its own Wix API scopes, provision collections on an already-installed site, or release the app.

## App permissions

Review the permissions for the app in Wix Developer Center before testing:

- **Read Members** (SCOPE.DC-MEMBERS.READ-MEMBERS) is required for the live site-member directory. The server requests only the EXTENDED fieldset and returns the fields needed for this dashboard.
- Enable the permission that Wix currently associates with the AI Credits getBalance method. If Wix denies the call, the dashboard displays an error instead of inventing a zero balance. Verify the method's current permission mapping in Developer Center rather than granting unrelated scopes speculatively.
- Wix Data read/write scopes are required for the app-owned workflow access collection. The server uses elevated @wix/data methods only after validating the request identity.

Official references:
- Members: Query Members: https://dev.wix.com/docs/api-reference/crm/members-contacts/members/member-management/members/query-members?apiView=SDK
- AI Credits: Get Balance: https://dev.wix.com/docs/api-reference/account-level/ai-credits/get-balance?apiView=SDK
- Elevate API Call Permissions: https://dev.wix.com/docs/build-apps/develop-your-app/frameworks/wix-cli/project-development/elevate-api-call-permissions
- Data Collections Extension: https://dev.wix.com/docs/build-apps/develop-your-app/develop-an-app-with-the-cli/supported-extensions/backend/data-collections/add-a-data-collections-extension-with-the-wix-cli

## Workflow access storage

The WorkflowAccess collection is defined as an app-owned Wix CMS collection, so each site that installs or updates the app has its own independent allowlist. A row's item ID is the Wix site member ID. The collection stores only the member ID and grant audit fields; it doesn't copy the member's profile or login email.

The Wix site must have CMS available for the data-collections extension. Wix documents that collection extension changes are provisioned when an app version is released and the site installs or updates to that version. This branch intentionally does not run wix release or publish anything.

## Authorization boundaries

- Dashboard API routes require an active Wix USER identity.
- The site widget access-check route requires a signed-in MEMBER identity and derives the member ID from Wix's token; it does not accept an ID from the browser.
- The approved-member lookup and changes run on the server. The site widget cannot read or edit the allowlist.
- Future endpoints that create, edit, schedule, or publish blogs must call requireApprovedSiteMember() before doing protected work.
- The Wix AI Credits API can return either SITE or ACCOUNT scope. The dashboard displays the scope returned by Wix instead of assuming that account-wide credits belong solely to one site.

## Local setup after pulling

Run npm install once to install the three added Wix SDK packages and refresh package-lock.json, then run npm run typecheck and npm run build.

Finally test in wix dev against the development site after app permissions and collection provisioning are ready. A successful local build does not prove that the Wix app instance has been granted the required permissions.
