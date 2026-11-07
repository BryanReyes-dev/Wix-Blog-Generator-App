# Repository agent entry point

This file is the root instruction entry point for coding agents. Wix CLI-specific instructions are available at:

`node_modules/@wix/cli/agents/instructions.md`

Run `wix skills update` when the installed Wix skills need refreshing.

## Before substantial changes

Read these project documents in order:

1. [Agent instructions and documentation map](agents-files/AGENTS.md)
2. [Current implementation context](agents-files/CONTEXT.md)
3. [Architecture and security boundaries](agents-files/ARCHITECTURE.md)
4. [AI-assisted development workflow](agents-files/AI-WORKFLOW.md)
5. The focused [authentication sign-off](agents-files/ADMIN-AUTH-FLOW.md) or [Wix permissions guide](agents-files/WIX-PERMISSIONS.md) when the work touches those areas.

Inspect the actual branch, working tree, source, package scripts, tests, and installed Wix SDK references before editing. Keep client components focused on UI and React state; keep Wix API calls, authorization, validation, and sensitive operations in the server layer.

Work in small, testable slices. Preserve unrelated local changes. Verify SDK contracts and permission scopes against current Wix documentation rather than assuming them. Report only checks actually run, and distinguish automated results from manual development-site verification.

Do not expose secrets, tokens, private article data, or raw uploaded files. Do not commit, push, merge, release, or switch branches unless the user explicitly asks.

The human-facing project overview and local setup are in [README.md](README.md). The documentation index is [agents-files/README.md](agents-files/README.md).
