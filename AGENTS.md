# Repository Guidelines

## Project Structure & Module Organization

- `mod.ts`: public entrypoint; re-exports the library API (entities +
  `Duckling`).
- `src/`: implementation modules (parsers/entities). Files are typically
  `PascalCase.ts` (e.g. `src/Time.ts`, `src/Quantity.ts`) plus shared helpers
  like `src/common.ts`.
- `tests/`: Bun tests. Naming convention is `*.test.ts` (e.g.
  `tests/Time.test.ts`).
- `package.json`: Bun development scripts and npm package metadata.
- `deno.json`: JSR package metadata and Deno dependency mappings.

## Build, Test, and Development Commands

This library uses Bun for development while retaining Deno/JSR compatibility.

- `bun install`: install the pinned development dependencies.
- `bun run check`: run formatting, lint, type checks, and tests.
- `bun run format`: format supported files with `oxfmt`.
- `bun run lint`: lint the library, tests, benchmarks, and scripts.
- `bun run typecheck`: type-check the development surface.
- `bun run package:check`: build and validate the npm package.

## Coding Style & Naming Conventions

- TypeScript. Keep code runtime-neutral and let `oxfmt` enforce formatting.
- Modules/entities in `src/` use `PascalCase.ts`; test files use
  `Thing.test.ts`.
- Prefer explicit exports via `mod.ts` for anything intended as public API.

## Testing Guidelines

- Framework: Bun's built-in test runner with local assertion helpers.
- Add/extend tests alongside new parsers/entities; cover both “happy path” and
  common false-positive/false-negative cases (see `tests/Time.test.ts` for
  patterns).

## Commit & Pull Request Guidelines

- Commit messages mostly follow Conventional Commits: `feat(scope): ...`,
  `fix: ...`, `chore: ...`, `docs: ...`. Use that style for new changes.
- PRs should include:
  - brief description + rationale (and link issues if applicable)
  - updated tests for behavior changes
  - `bun run check` and `bun run package:check` passing
