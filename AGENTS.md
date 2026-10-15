## CLI Commands

All CLI instructions can be found at:
node_modules\@wix\cli\agents\instructions.md

## Skills

This project comes with a set of skills that can be used when the user asks for help with specific tasks.
If you're using the instructions provided by a skill and fail, or if you do not find a relevant skill for the task,
you can try updating the skills by running the following command:

`wix skills update`

This will update the skills to the latest version.
## AI-assisted development workflow

Before changing code, read [`agent-files/AI-WORKFLOW.md`](agent-files/AI-WORKFLOW.md) and follow its inspect → plan → scaffold → refine → validate workflow.

- Inspect the current branch, working tree, relevant implementation, and project instructions before proposing edits. Preserve unrelated local changes.
- Work in small, testable slices with explicit acceptance criteria. Prefer extending existing code over replacing it wholesale.
- Use the installed Wix CLI and official Wix SDK documentation for supported extension scaffolding and APIs. Do not invent SDK methods or manually recreate Wix-generated boilerplate when the CLI can generate it.
- Explain changed files and meaningful trade-offs in plain language. Treat generated code as a draft that must be reviewed and tested.
- Report only checks actually run and their real results. Clearly label manual checks, Wix-environment checks, and unverified behavior.
- Do not expose secrets, print environment-variable values, or place credentials in source control.
- Do not commit, push, merge, release, or switch branches unless the user explicitly directs that action.
