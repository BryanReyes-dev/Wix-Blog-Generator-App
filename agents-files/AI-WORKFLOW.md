# AI-assisted development workflow

## Goal

Use AI to accelerate implementation without sacrificing understanding, review, or maintainability. AI-generated code is a proposal; the developer remains responsible for design decisions, validation, and release.

## Default cycle

### 1. Inspect

- Confirm the repository, current branch, and `git status`.
- Read root `AGENTS.md` and the relevant files under `agents-files/`.
- Inspect the source, extension registration, `package.json`, lockfile, and tests.
- Preserve unrelated local changes.
- For Wix APIs, permissions, rich-content schemas, and extension changes, read the relevant installed Wix skill and current official documentation first.

### 2. Plan

Describe the visible behavior, acceptance criteria, smallest reasonable file set, security risks, permissions, and validation steps. Prefer explicit boundaries and incremental slices over large speculative abstractions.

### 3. Implement

Follow the repository's separation of responsibilities:

- React components render visible UI and receive data/actions through typed props.
- Hooks own reusable React state, effects, and lifecycle logic.
- Plain TypeScript modules own deterministic helpers, API-client wrappers, local storage, browser media processing, style tokens, and constants.
- Astro route handlers own HTTP request/response behavior.
- Server-only modules own Wix authentication/authorization, approval checks, data access, AI calls, media verification, and draft creation.
- Shared types belong in a relevant feature-level types module, not duplicated across components.
- Keep Wix extension registration and generated config structures intact. Use Wix CLI generators for new supported extensions.

Do not turn a utility into a React component merely to make the repository look component-based. Avoid unnecessary dependencies and avoid changing stable Wix/security boundaries as part of unrelated UI refactors.

### 4. Refine

Explain each meaningful file's responsibility and important trade-offs. Review actual diffs, not just generated summaries. For bugs, reproduce the failing case and add a focused regression test where practical.

### 5. Validate

Use the scripts declared in `package.json`. The baseline is:

```bash
npm run test:all
npm run typecheck
npm run build
```

Run focused tests first when possible. Wix development-site checks are separate from automated checks; a passing build does not prove permissions, Wix AI authorization/billing, upload readiness, GIF animation, or Blog rendering.

Record only checks actually run and note behavior that still needs a Wix account or development site.

### 6. Hand off

Before completion:

- Re-read the diff for accidental unrelated changes, stale names/paths, dead code, unsafe error handling, and secrets.
- Confirm acceptance criteria or explicitly label anything unverified.
- Summarize key file responsibilities, tests, manual Wix checks, and follow-up actions.
- Leave commit, push, merge, release, and branch switching decisions to the user unless explicitly requested.

## Current app boundaries

- Wix manages site-member login. Server routes verify tokens and approval; page redirects are not a security boundary.
- Article generation uses the Wix-managed `@wix/ai` integration with the Vercel AI SDK. `WIX_AI_MODEL` defaults to `gpt-5-mini`; a standalone `OPENAI_API_KEY` is not required.
- Research URL retrieval and citation validation are a server concern.
- AI visual references are derived JPEG frames/stills, separate from original article images.
- Original article images/GIFs are uploaded through the server-authorized Wix Media Manager path and are validated again at draft submission.
- Draft creation happens only after explicit user action, approval and author checks, media verification, and Wix Blog installation verification. The draft is created with `publish: false`.

For enduring architecture decisions, update [ARCHITECTURE.md](ARCHITECTURE.md). For current blockers and handoff notes, update [CONTEXT.md](CONTEXT.md). For public usage, update the root [README.md](../README.md).
