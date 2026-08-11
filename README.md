# PULSE

PULSE is a modular software platform for orthopaedic technology and medical
supply companies. See `CLAUDE.md` for the binding product/architecture
context (Decisions #1–#8) before making changes here.

This repository currently contains the **first implementation iteration**:
the PULSE-Core technical/domain foundation only (not the final product UI).
It proves the domain hierarchy `Customer -> AssistiveDevice -> Case ->
Appointment` end to end, with authentication, permission-based authorization,
an audit-event foundation, and a throwaway dev/admin UI — see `apps/dev-console/README.md`.

## Repository layout

```
apps/
  api/           PULSE-Core backend (NestJS + Drizzle ORM + PostgreSQL)
  dev-console/   Throwaway dev/admin UI (React + Vite) — not the future Cockpit
packages/
  domain/        Shared zod schemas + TS domain types (backend + all future clients)
  api-types/     TS types generated from the served OpenAPI document (convenience only)
  config/        Shared tsconfig / eslint / prettier config
```

## Prerequisites (this Mac)

- Node.js (a current LTS; check with `node -v`)
- [pnpm](https://pnpm.io) — if not already installed: `npm install -g pnpm`
- Docker Desktop (for local Postgres) — if not already installed:
  `brew install --cask docker`, then open Docker Desktop once to finish its
  first-launch setup

## First-time setup

```sh
pnpm install

cp .env.example .env    # edit if you changed any defaults

docker compose up -d    # starts local Postgres on :5432

pnpm migrate             # applies apps/api/drizzle/*.sql to the local database
pnpm seed                 # dev-only seed data — see apps/api/src/database/seed.ts
```

The seed script prints a dev admin login (email/password) to sign in with.

## Running

```sh
pnpm dev
```

This runs the API (`http://localhost:3000/api/v1`, OpenAPI docs at
`http://localhost:3000/api/docs`) and the dev console
(`http://localhost:5173`) together.

## Everyday commands

```sh
pnpm build       # build all packages/apps
pnpm lint        # eslint across the monorepo
pnpm typecheck   # tsc --noEmit across the monorepo
pnpm test        # unit tests across the monorepo
pnpm migrate     # apply pending migrations
pnpm seed        # (re-)apply dev-only seed data — refuses to run with NODE_ENV=production
```

To change the schema: edit `apps/api/src/database/schema.ts`, then run
`pnpm --filter @pulse/api migrate:generate` to produce a new SQL migration
file under `apps/api/drizzle/`, and commit the generated file.

## What this iteration deliberately does not include

Per CLAUDE.md, this iteration is foundation-only. It does not implement: the
Module SDK / connectors-integration layer (Decisions #7–#8), the relay
(Decision #5's outbound relay is unaffected/untouched — this is all local
development), OIDC/MFA/SMTP password recovery/emergency recovery (Decision
#4), desktop/mobile app shells, or any real Cockpit/CRM/ERP UX. See
CLAUDE.md's "Open decisions" section for what remains genuinely undecided.
