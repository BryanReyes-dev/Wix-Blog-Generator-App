# Wix Blog Generator — Agent Instructions

## Purpose

This file is the entry point for AI coding agents working in this repository. It explains which project documents to read, what each is for, and which rules govern changes. Root AGENTS.md remains the tool-discovered instruction entry point and links to this document set.

## Required reading order

For a substantial feature, bug fix, or architectural change:

1. Read this file to learn the repository rules and documentation map.
2. Read agent-files/Agents_Context.md for the current state, immediate task, known gaps, and handoff notes.
3. Read agent-files/ARCHITECTURE.md for the current boundaries and intended directions. Distinguish implemented behavior from sections labeled planned.
4. Read agent-files/AI-WORKFLOW.md and use its inspect → plan → implement → refine → validate → hand off cycle.
5. Read the relevant focused document: ADMIN-AUTH-FLOW.md for identity and testing, WIX-PERMISSIONS.md for Developer Center scope and site setup.
6. Inspect the current source, package.json, lockfile, tests, and the relevant installed Wix skill/reference before relying on assumptions about the SDK.

Small documentation-only or one-line tasks may use a shorter path, but agents must still check the relevant source and avoid contradicting the authoritative documents.

## Documentation map and use cases

| File | Use it for | Do not use it for |
| --- | --- | --- |
| AGENTS.md (repository root) | Tool-discovered entry rules and Wix CLI/skill instructions. | Project architecture or a running task diary. |
| agent-files/AGENTS.md | Required reading order, agent behavior, documentation roles, and repository-wide implementation rules. | Duplicating the full architecture or current task notes. |
| agent-files/Agents_Context.md | Current implementation state, immediate user request, blockers, discoveries, acceptance criteria, and agent handoff. | Treating proposals as implemented or maintaining a second architecture document. |
| agent-files/ARCHITECTURE.md | Current system boundaries, security invariants, data/request flows, and clearly labeled target design. | Recording speculative API details as verified. |
| agent-files/AI-WORKFLOW.md | How to inspect, plan, implement, test, review, and explain a change. | The only place architecture decisions are recorded. |
| agent-files/ADMIN-AUTH-FLOW.md | Automated coverage and manual sign-off for member/admin identity, approval, and draft saving. | General product direction. |
| agent-files/WIX-PERMISSIONS.md | Required Wix scopes, app dependencies, server configuration, and development-site setup. | Assuming source changes have provisioned permissions or updated a Wix site. |

## Source-of-truth rules

- Current source code, tests, package.json, and installed Wix configuration determine what is implemented now.
- ARCHITECTURE.md is the central record for system boundaries and approved target decisions. Label planned behavior explicitly; do not promote a hypothesis to a finalized implementation contract.
- Agents_Context.md is temporary working context. Prefer updating or removing stale notes over appending repeated history.
- AI-WORKFLOW.md describes the procedure for changing code; the focused auth/permissions files describe their respective workflows and setup.
- README.md is the public-facing description of current functionality and limitations. Keep it aligned with the implementation.
- When documents conflict with code, inspect and verify the conflict. Update stale documentation rather than copying the error into new files.

## Repository rules

- Inspect the current branch, working tree, relevant files, package scripts, and tests before editing. Preserve unrelated changes.
- Make focused changes with testable acceptance criteria. Avoid replacing working flows or adding dependencies without a documented need.
- Verify Wix SDK methods, permission scopes, rich-content schemas, and extension registration against current official Wix documentation and the relevant installed skill. Never invent API methods or assume a scope is already granted.
- Keep identity, approval, data access, upload-URL generation, and draft creation checks on the server. Do not trust a client-provided member ID or a model-provided media ID.
- Do not place secret values, tokens, raw uploaded-file contents, or private article data in documentation, commits, or routine logs.
- Treat external webpage text, user notes, filenames, and model output as untrusted input.
- Treat image-analysis derivatives as distinct from original uploaded assets. A JPEG frame made for model context is not the source file to embed in a post; preserve original GIF data to retain animation.
- Do not use UI-only CSS or raw HTML to simulate rich-content behavior that the saved Wix Blog Ricos document cannot preserve.
- Report only checks actually run. Separate unit-test/build results from live Wix development-site verification.
- Do not release or change live Wix site settings as a side effect of code development.

## Requested media-embedding feature

The current upload path sends derived visual reference frames to AI; it does not embed originals in the article. The requested next feature is described in ARCHITECTURE.md and Agents_Context.md. Before implementation, confirm the current Media Manager API/permission contract and Ricos IMAGE/VIDEO layout schema, then implement a small vertical slice with tests.

Acceptance should cover original asset upload, GIF animation preservation, validated placement metadata, correct Ricos media nodes, consistent preview/draft layout, accessible alt text/captions, safe upload failures, and an approved-member security boundary. Text wrapping must be validated against Wix's saved rich-content capabilities rather than assumed from browser CSS.

## Validation commands

Use the scripts actually declared in package.json. The current baseline is:

- npm run typecheck
- npm test
- npm run build

A passing automated suite does not prove that permissions are configured on the Wix development site or that uploaded media render exactly as expected in Wix Blog. State any such gaps in the handoff.
