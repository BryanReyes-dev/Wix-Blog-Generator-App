# AI-Assisted Development Workflow

## Goal

Use AI to establish a useful foundation quickly, then refine it through deliberate edits, testing, and review. AI-generated code is a proposal, not proof that a feature works. The developer remains responsible for scope, design decisions, acceptance, and release.

## Default cycle

### 1. Inspect before editing

- Confirm the repository, current branch, and `git status`.
- Read the relevant source files, `AGENTS.md`, package scripts, and existing tests.
- Read the relevant installed Wix skill/reference and official SDK documentation before using a Wix API.
- Identify existing behavior and local changes that must be preserved.
- Do not assume that README text describes unfinished work as implemented. Keep README focused on current behavior; use `ARCHITECTURE.md` for intended/future design and clearly label plans as plans.

### 2. Plan a small feature

Before implementation, provide:

- The desired user-visible behavior.
- Testable acceptance criteria.
- The smallest reasonable set of files to change.
- Relevant dependencies, Wix permissions/configuration, and risks.
- The tests or manual checks needed to verify the outcome.

If a detail is nonessential, choose a conservative assumption and state it rather than blocking progress. Ask a question only when the missing decision materially changes the architecture or behavior.

### 3. Generate the foundation

- Prefer the project's existing stack and conventions; do not add a framework or dependency without a concrete reason.
- Use the installed Wix CLI generators for supported extension scaffolding and registration.
- Generate only the smallest useful slice. Avoid generating a full system when one working component or flow is enough.
- Separate presentation, Wix API interaction, and business logic where doing so improves testing or comprehension; do not add abstractions without a current need.
- Do not implement authentication, authorization, data access, or secret handling from assumptions. Verify platform-supported behavior against current documentation.

### 4. Refine with the developer

- Explain each changed file's responsibility and any important TypeScript/API concepts.
- Make targeted edits in response to observed behavior, errors, or user feedback.
- Prefer a focused diff over rewriting files that already work.
- When asking AI to review code, request concrete findings with file/line references and reproducible reasoning, not a vague confidence score.
- For bugs, reproduce or describe the failing case first, then make the smallest fix and add a regression check where practical.

### 5. Validate in layers

Run the smallest useful checks first, then broader checks. Use the scripts that actually exist in `package.json`.

For this Wix app, the usual baseline is:

```bash
npm run typecheck
npm run build
```

For Wix extension behavior, also test it in the appropriate Wix development site/editor. A successful typecheck or build proves neither authentication behavior nor end-to-end functionality. Site widgets, in particular, may require testing through `wix dev` and the development site's editor; a shareable preview alone may not register every extension.

For every relevant test, record:

- Command or manual steps performed.
- Pass/fail outcome and the meaningful error output.
- Behavior that remains untested, requires a Wix account/site, or depends on permissions/settings.

Never claim a test passed if it was not run. Do not release a new app version as a routine debugging step unless that is part of the user's explicit goal.

### 6. Review and hand off

Before finishing:

- Re-read the actual diff and look for unrelated edits, dead code, unsafe assumptions, accidental secrets, and error paths that hide failures.
- Confirm each acceptance criterion is either verified or explicitly marked unverified.
- Summarize what changed, why, what the developer should understand, commands run, manual Wix checks, and remaining work.
- Leave commit, push, merge, branch switching, and release decisions to the user unless the user explicitly authorizes them.

## Prompt template

```text
Use this repository's AI-assisted workflow.

First inspect the current branch, working tree, relevant files, project instructions,
and official Wix documentation. Do not edit yet.

Propose a small implementation plan with acceptance criteria, files to change,
risks, and validation steps. Once the plan is agreed, scaffold the smallest
functional foundation using the existing stack and Wix CLI where appropriate.
Explain important code and decisions, then help me refine it in focused steps.
Run the relevant checks and report their actual outcomes. Do not commit, push,
merge, release, or switch branches without my explicit direction.
```

## Current Wix Blog Generator workflow

This repository now has an approved-member workflow for generating, reviewing, editing, and explicitly saving unpublished Wix Blog drafts. It is not just a login prototype.

Before a substantial change, also read:

- [Repository-specific agent instructions](./AGENTS.md)
- [Current working context](./Agents_Context.md)
- [Architecture and current/planned boundaries](./ARCHITECTURE.md)
- [Authentication and manual sign-off](./ADMIN-AUTH-FLOW.md) when touching member or admin access
- [Wix permissions and setup](./WIX-PERMISSIONS.md) when touching scopes, app installation, AI, Media Manager, or Blog APIs

Current implementation boundaries:

- Wix owns site-member login. Protected server routes verify Wix identity and check the app-owned approval record; a hidden page or widget redirect is not the security boundary.
- Article generation uses the Wix-managed @wix/ai integration with the Vercel AI SDK. WIX_AI_MODEL selects the model and defaults to gpt-5-mini. Do not configure or require a standalone OPENAI_API_KEY unless the implementation and architecture are deliberately changed.
- Research links and citation validation are implemented as a separate server concern from media references.
- Current media uploads are sent to the model as derived JPEG frames. The original files are not uploaded to Wix Media Manager, and article content does not yet contain uploaded-media placements. Consult ARCHITECTURE.md and Agents_Context.md before implementing this feature; retain original GIF data instead of reusing JPEG analysis frames.
- Draft creation happens only after the member explicitly submits the reviewed article, verifies the generating member, and checks that Wix Blog is installed. The create call uses publish: false.

Use the installed Wix app skills and current official documentation for Wix API work. The repository's Wix SDK contracts, app permissions, and live-site behavior can change. Do not assume that a successful typecheck/build proves end-to-end permission, Media Manager upload, or Blog rendering behavior.
