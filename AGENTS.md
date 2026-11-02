<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN ADCE -->
## ADCE

This repository uses ADCE for artifact context management.

Before repository-level modifications:

1. Run `adce status`.
2. Run `adce context --task "<current task>" --format markdown`.
3. Read sections in order: MUST READ → CAUTION → TRUST ORDER → ALSO RELEVANT.
4. Do not trust CAUTION artifacts over TRUST ORDER / VERIFIED sources.
5. Run `adce conflicts` (and `adce analyze` if available) when CAUTION is non-empty.
6. Set known trust with `adce authority set <id> -l CANONICAL|AUTHORITATIVE|SUPPORTING`.
7. Run `adce structure` (default profile: software-eng). Replace stub content in `requirements/`, `design/`, `architecture/`, `decisions/`, `security/`, `schemas/`, `docs/testing/`, and API specs with real project knowledge when those files are still stubs or SUGGESTED.
8. Developers: fill those artifacts yourself, or prompt the coding agent to draft them from the current task/codebase, then review and verify (`adce artifact verify`).
<!-- END ADCE -->
