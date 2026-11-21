# AGENTS.md — trac-portal-api

Instructions for AI coding agents and human contributors. Plain Markdown, tool-agnostic.

## Purpose & context

This is the NestJS backend of the TRAC Portal, used by an amateur radio club (TRAC Erzurum) to manage operators, branches, radio nets, equipment, disasters and observations. It serves the Vue frontend `trac-portal-ui` under the `/api` prefix.

- Root repo: [TRAC-Erzurum/trac-portal](https://github.com/TRAC-Erzurum/trac-portal). It holds the issues and orchestrates the submodules. Cross-repo contracts (routes, auth cookie, roles, locales, OIDC) are in its `docs/system/contracts.md`. Read that before changing anything a client depends on.
- Issues live only in the root repo. This repo takes pull requests only.
- Deployment is done manually by product owners. Agents never deploy.

## Stack

Read exact versions from `package.json`. Ranges are shown here for orientation only.

- NestJS 11 (`@nestjs/core` ^11.1.16), platform Express
- TypeScript (^5.9.3), compiled with `nest build`
- TypeORM (^0.3.28) on PostgreSQL (`pg` ^8.20.0)
- Auth: Passport JWT (`passport-jwt`), Google OAuth (`passport-google-oauth20`), OIDC provider
- Validation: class-validator (^0.15.1) and class-transformer
- Jest (^30.2.0) with ts-jest for unit tests; ESLint (^10) with typescript-eslint and Prettier
- Package manager: **yarn 1** (`yarn.lock`). Never use npm to install.
- Node.js 24 LTS (the Docker base image uses `node:24-alpine`; CI uses `node-version: 24`; `package.json` `engines` is `>=24`)

## Setup & run

```bash
yarn install --frozen-lockfile
cp .env.example .env        # humans only; fill in local values
yarn start:dev              # watch mode on PORT (default 8000)
```

- Required env vars at startup: `COOKIE_SECRET`, `SESSION_SECRET`, `DB_HOST`, `DB_PORT`, `DB_NAME`. The full list and meaning is in `.env.example`.
- The app needs a reachable PostgreSQL. Do not point an agent session at a shared or production database.
- Never read, print or commit `.env`. Reference variable names only.

## Verify

```bash
yarn verify
```

`verify` = `lint:check` + `build` + `test` (unit tests). CI runs the same command. A change is done when `yarn verify` passes locally and in CI.

- `yarn lint` runs ESLint with `--fix`. Use it for formatting; use `lint:check` to verify.
- `yarn test:e2e` is not part of `verify`, and its config file `test/jest-e2e.json` does not exist yet. Do not rely on it.

## Project structure

```
src/
  app.module.ts, main.ts       bootstrap, global pipes, filters, guards
  auth/  user/  operator/  branch/  net/  net-scheduler/  ...   feature modules
  shared/                      config, base entity, filters, storage, logging, utils
  config/                      TypeORM CLI data source, run-migrations.ts
  migrations/                  TypeORM migrations
test/                          shared test helpers (not specs)
```

Feature modules follow `controllers/ services/ entities/ dto/` (plus `guards/`, `enums/`, ... when needed). Details: [docs/conventions/module-structure.md](docs/conventions/module-structure.md).

## Conventions

Read the file for your task before you change code:

- [docs/conventions/module-structure.md](docs/conventions/module-structure.md): layout, naming, barrels, registration
- [docs/conventions/api-design.md](docs/conventions/api-design.md): routes, DTO validation, i18n error keys, pagination, serialization, files
- [docs/conventions/auth-and-roles.md](docs/conventions/auth-and-roles.md): guards, `@Public`/`@Roles`/`@AllowWithoutCallsign`, role ranks, resource authorization
- [docs/conventions/database-and-migrations.md](docs/conventions/database-and-migrations.md): entities, migration creation and safety rules
- [docs/conventions/events-and-logging.md](docs/conventions/events-and-logging.md): activity events, diagnostic logging, what must never be logged

Key rules in short: business errors are i18n keys (`error.notFound`), not English text; routes are protected by default; the schema changes only through migrations; never log secrets.

## Database migrations

Agents write migration files only. Agents never run migrations, generate them against a database, or run seeds or SQL against any database. Create files with `yarn migration:create src/migrations/<Name>`, implement `up()` and `down()`, and follow [docs/conventions/database-and-migrations.md](docs/conventions/database-and-migrations.md). Migrations run at container start (`docker-entrypoint.sh`, after a backup).

## Testing policy

> Tests are expensive; keep them to a minimum. Do not add tests by default and never add "write tests" as a routine acceptance criterion. Add a test only when it rests on a solid reason: authentication/authorization, data integrity or irreversible operations, non-trivial pure logic (parsing, date/time, state machines), or a production bug likely to recur. State that reason in one sentence in the PR description. End-to-end tests and any new test framework/infrastructure require explicit approval from the project owner. Do not write tests for trivial CRUD, getters, rendering/snapshots, or mock-heavy controller code. Existing tests stay and must pass.

Unit specs are `src/**/*.spec.ts`. Run one with `yarn test <pattern>`.

## Git & PR workflow

- `main` is protected. Branch from up-to-date `main` with a task-specific name, for example `fix/<short-topic>` or `chore/<topic>`.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `chore:`, `style:`, `docs:`), with the issue number when there is one, for example `fix: ... (#123)`.
- Open a PR against `main` using `.github/pull_request_template.md`. Link the root issue with `Closes TRAC-Erzurum/trac-portal#<n>`.
- Keep a PR to one concern. Do not mix dependency upgrades, refactors and features.
- After the PR merges, a root-repo PR bumps this submodule pointer. Do not edit the root repo from here.
- CI builds a Docker image on pull requests and pushes it to GHCR on `main`. Tags are not created by agents.

## Boundaries

- Never push to `main`, force-push, or bypass branch protection or required checks.
- Never deploy, and never touch the production server or production data.
- Never run migrations, seeds, or destructive commands (`DROP`, `TRUNCATE`, mass `DELETE`/`UPDATE`) against any database.
- Never read, print, log or commit `.env` files, keys, tokens or other secrets.
- Do not change dependencies or the lockfile unless the task is a dependency task.
- Do not weaken authentication, authorization, validation or logging to make a check pass.
- Stop and report when the task needs a change outside its scope, a product decision, or an irreversible action.
