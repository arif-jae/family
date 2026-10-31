# AGENTS

## Project context
- This repository is a web project workspace.
- Keep changes small, readable, and consistent with the existing stack.
- Prefer the simplest correct solution over large refactors.

## Working rules
- Before making changes, inspect the relevant files and confirm the root cause.
- Do not add secrets, tokens, passwords, or .env values to source control.
- Preserve existing conventions for naming, formatting, and architecture.
- If a feature is not explicitly requested, do not broaden the scope beyond the task.
- When the project is empty or missing context, create minimal, production-friendly scaffolding rather than unnecessary complexity.

## Validation
- Run the smallest relevant validation command after changes.
- If no automated tests exist, at least verify the affected command or script runs successfully.

## Output expectations
- Provide concise summaries of what changed and any verification results.
- Highlight risks, assumptions, or follow-up tasks when relevant.
