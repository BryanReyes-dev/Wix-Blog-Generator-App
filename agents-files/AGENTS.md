# Wix Blog Generator — agent instructions

## Purpose

This document is the entry point for coding agents working in the repository. It defines the required reading order, documentation roles, implementation rules, and source-of-truth expectations. The root [AGENTS.md](../AGENTS.md) links here.

## Required reading order

For a substantial feature, bug fix, or architectural change:

1. Read this file.
2. Read [CONTEXT.md](CONTEXT.md) for current implementation state, active work, known gaps, and handoff notes.
3. Read [ARCHITECTURE.md](ARCHITECTURE.md) for application boundaries, data flows, and security invariants.
4. Read [AI-WORKFLOW.md](AI-WORKFLOW.md) and follow its inspect → plan → implement → refine → validate → hand off cycle.
5. Read [ADMIN-AUTH-FLOW.md](ADMIN-AUTH-FLOW.md) for identity or approval work, or [WIX-PERMISSIONS.md](WIX-PERMISSIONS.md) for Wix scopes and site setup.
6. Inspect source, package.json, lockfile, tests, Wix configuration, and the relevant installed Wix skill/reference before relying on SDK assumptions.

Small documentation-only or one-line changes may use a shorter path, but must still verify the relevant source and avoid contradicting the implementation.

## Source of truth and documentation roles

- Current source, tests, `package.json`, lockfile, and Wix extension configuration determine what is implemented.
- [ARCHITECTURE.md](ARCHITECTURE.md) is the durable record of system boundaries and approved architectural decisions. Mark planned behavior explicitly.
- [CONTEXT.md](CONTEXT.md) is temporary working context. Keep it concise; update stale notes instead of appending repeated history.
- [AI-WORKFLOW.md](AI-WORKFLOW.md) describes the engineering process, not the architecture.
- Root [README.md](../README.md) is the human-facing description of current behavior, setup, and limitations.
- [agents-files/README.md](README.md) is the index to the maintainer/agent docs.
- When documentation conflicts with code, inspect and verify the conflict, then update stale documentation rather than repeating it.

## Repository rules

- Inspect the current branch, working tree, source, package scripts, and tests before editing. Preserve unrelated changes.
- Make focused changes with testable acceptance criteria. Prefer extending working code over replacing it wholesale or adding unnecessary dependencies.
- Use the installed Wix CLI generators for supported extension scaffolding and registration. Verify Wix SDK methods, rich-content schemas, extension contracts, and permission scopes against current official Wix documentation and installed skills.
- Keep identity verification, authorization, approval checks, upload URL generation, media verification, and draft creation on the server. Never trust a client-supplied member ID or model-provided media ID.
- Treat webpage text, source notes, filenames, user-provided content, and AI output as untrusted data.
- Keep visual-reference derivatives distinct from original article media. JPEG frames are AI context; original uploaded GIF bytes must be retained for article insertion.
- Do not use UI-only CSS or raw HTML to simulate rich-content behavior the saved Wix Ricos document cannot preserve.
- Keep secrets, tokens, private article data, and raw uploaded files out of documentation, source control, and routine logs.
- Report only checks actually run. Separate automated tests/build results from manual Wix development-site verification.
- Do not release the app or change live Wix site settings as a side effect of code development.

## React and module organization

- Use React components for visible UI and composable interface sections. Keep components focused and pass data/actions through typed props.
- Put reusable state/effect logic in hooks whose names begin with `use`.
- Put deterministic helpers, browser media processing, API client wrappers, style constants, and IDs in ordinary TypeScript modules when they do not need React.
- Keep shared UI contracts in the widget-level `types.ts`; do not duplicate equivalent type definitions inside individual components.
- Keep Wix/HTTP endpoints under `src/pages/api`, Wix extension registration under `src/extensions.ts` and generated extension files, and server-only logic under `src/lib/server`.
- Avoid making every file a component. Components own rendering; hooks own reusable React state; utility modules own non-React operations; API routes and server modules own backend work.

## Validation

Use commands declared in `package.json`. The main baseline is:

```bash
npm run test:all
npm run typecheck
npm run build
```

A successful local build or mocked test does not prove Wix site permissions, Wix AI billing, media upload readiness, GIF rendering, or final Blog layout. State those gaps until they are manually verified on a non-production development site.
