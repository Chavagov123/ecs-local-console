# Contributing to ECS Local Console

Thanks for taking a look. This is a small, focused project — a dedicated GUI for
**LocalStack ECS** (and anything else that speaks the ECS API). Issues and PRs are welcome.

## Project shape

A pnpm workspace monorepo:

| Package | What it is |
|---|---|
| `apps/web` | React 18 + Vite + shadcn/ui SPA. `@tanstack/react-query` is the entire state layer; routes are code-split. |
| `apps/server` | Fastify 5 + AWS SDK v3. A thin translator: it makes the real ECS calls, hydrates `List*`→`Describe*`, normalizes errors, runs the reconciliation engine, and serves the built SPA in production. |
| `packages/shared` | Wire types (`api-types.ts`), the zod task-definition schema, concept annotations. Imported by both sides. |

The browser only ever talks to its own origin (`/api`) — it never signs AWS requests. Every
read is `cache.wrap("prefix:…", produce)`; every write is `cache.invalidate("prefix:")`.
The backend is **endpoint-agnostic**: it works against LocalStack, MiniStack, Moto, or real
AWS purely by changing `AWS_ENDPOINT_URL` — keep it that way (no LocalStack-specific
assumptions in `apps/server`).

## Dev setup

Prerequisites: **Node 22+**, **pnpm 11**, and Docker (for LocalStack) — or nothing extra if
you point at [Moto](https://docs.getmoto.org) / [MiniStack](https://ministack.org).

```sh
pnpm install
cp .env.example .env          # defaults to http://localhost:4566
pnpm dev:stack                # LocalStack via docker-compose.dev.yml
pnpm dev                      # web on :8080, API on :4570
```

Seed something to look at:

```sh
aws --endpoint-url=http://localhost:4566 ecs create-cluster --cluster-name demo
```

No Docker? Run Moto instead (`pip install "moto[server]" && python -m moto.server -p 5001`)
and set `AWS_ENDPOINT_URL=http://localhost:5001`.

## Checks

Run before opening a PR — CI runs the same:

```sh
pnpm lint
pnpm typecheck
pnpm test          # vitest across all packages
pnpm build         # shared → server → web

# optional: the full lifecycle test against a live emulator (CI uses Moto)
RUN_INTEGRATION=1 AWS_ENDPOINT_URL=http://localhost:5001 \
  pnpm --filter @ecs-local-console/server test:integration
```

### Test conventions

- **Server**: `mockClient(ECSClient)` (from `aws-sdk-client-mock`) + `buildApp({ env })` +
  `app.inject()`. See `apps/server/test/routes/*`.
- **Web**: MSW (`apps/web/src/test/msw/`) + `renderWithProviders` (`apps/web/src/test/render.tsx`).
- **Pure logic** (the reconciliation differ, CLI builders) gets a plain unit test.
- The integration test honours documented emulator gaps — assertions there are permissive.

## Adding a backend endpoint

1. Need a new AWS client? Add a `ClientKind` + one memoized method in
   `apps/server/src/aws/clients.ts`.
2. A `services/*.ts` function that does the `List*`→`Describe*` work behind `cache.wrap`.
3. A `routes/*.ts` plugin; register it in `apps/server/src/app.ts` inside the `/api` plugin
   (before `fastifyStatic`).
4. Wire types in `packages/shared/src/api-types.ts`; a `qk.*` key + hook in `apps/web/src/api/`.

## Commit / PR

- Branch from `main`; keep PRs scoped to one change.
- Reference an issue where there is one.
- New user-facing behaviour needs a test and a `CHANGELOG.md` entry under "Unreleased".

## Milestones

`v0.1.0` read-only browser · `v0.2.0` write UI · `v0.3.0` live reconciliation + logs ·
`v0.4.0` polish (theme, ⌘K, copy-as-CLI, diff, tags) · `v1.0.0` docs + adoption.
