# Repository Guidelines

## Project Structure & Module Organization

- `mod.ts`: public entrypoint; re-exports the library API (entities +
  `Duckling`).
- `src/`: implementation modules (parsers/entities). Files are typically
  `PascalCase.ts` (e.g. `src/Time.ts`, `src/Quantity.ts`) plus shared helpers
  like `src/common.ts`.
- `tests/`: Deno tests. Naming convention is `*.test.ts` (e.g.
  `tests/Time.test.ts`).
- `deno.json`: Deno config, dependency mappings, and tasks.

## Build, Test, and Development Commands

This is a Deno library (no npm scripts).

- `deno test`: run the full test suite in `tests/` (first run may download deps;
  use `deno test --cached-only` when offline).
- `deno fmt`: format all supported files (preferred over manual formatting).
- `deno lint`: lint the codebase. Note: on Deno 2.x this repo’s inline `https:`
  imports and JSON import attributes may be flagged; prefer adding deps to
  `deno.json` when touching imports.
- `deno check mod.ts`: type-check the public surface (add extra entrypoints as
  needed).

## Coding Style & Naming Conventions

- TypeScript (Deno). Keep code Deno-idiomatic and let `deno fmt` enforce
  formatting.
- Modules/entities in `src/` use `PascalCase.ts`; test files use
  `Thing.test.ts`.
- Prefer explicit exports via `mod.ts` for anything intended as public API.

## Testing Guidelines

- Framework: built-in `Deno.test` with asserts from `jsr:@std/assert`.
- Add/extend tests alongside new parsers/entities; cover both “happy path” and
  common false-positive/false-negative cases (see `tests/Time.test.ts` for
  patterns).

## Commit & Pull Request Guidelines

- Commit messages mostly follow Conventional Commits: `feat(scope): ...`,
  `fix: ...`, `chore: ...`, `docs: ...`. Use that style for new changes.
- PRs should include:
  - brief description + rationale (and link issues if applicable)
  - updated tests for behavior changes
  - `deno fmt`, `deno lint`, and `deno test` passing
