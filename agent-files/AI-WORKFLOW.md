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

## Wix Blog Generator app: current login prototype

The `feature/member-login-test` branch contains a site widget at
`src/extensions/site/widgets/member-login-test/`. It currently asks Wix for the
current site member, calls Wix's login prompt, and calls logout. Treat it as a
prototype until it has been exercised in a Wix development site. A site-member
session is not automatically equivalent to authorization for an app dashboard.

Use current official Wix documentation for login and CLI behavior:

- [About the Wix CLI](https://dev.wix.com/docs/wix-cli/guides/about-the-wix-cli)
- [Add a Custom Element Extension](https://dev.wix.com/docs/build-apps/develop-your-app/frameworks/wix-cli/supported-extensions/site/custom-elements/add-a-custom-element-extension-with-the-wix-cli)
- [Wix site-member promptLogin API](https://dev.wix.com/docs/sdk/frontend-modules/members/authentication/prompt-login)
- [Wix currentMember getMember API](https://dev.wix.com/docs/sdk/frontend-modules/members/current-member/get-member)

Do not replace the existing Wix member flow with a custom credential flow unless
the framework's supported authentication model has been checked and the change is
explicitly required.
