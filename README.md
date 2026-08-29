# ECS Local Console

A GUI for **[LocalStack](https://localstack.cloud) ECS** — browse and manage clusters,
services, tasks, and task definitions, and watch the scheduler reconcile in real time.

Works against anything that speaks the AWS ECS API on a configurable endpoint:
**LocalStack**, **[MiniStack](https://ministack.org)** (MIT-licensed, fully free), Moto, or
real AWS.

> Why this exists: LocalStack's own resource browser only does shallow cluster / task-def
> management and needs a LocalStack account; LocalStack Desktop is paid; the open-source
> browsers (StackPort, GuiStack) don't cover ECS at all. This is a dedicated, free ECS
> console.

## Status

Milestone **M0 — skeleton** is done: monorepo, backend with `/api/health`, `/api/config`,
`/api/clusters`, and a web app with a live clusters list + settings. See
[the plan](https://github.com/Chavagov123/ecs-local-console) for the roadmap
(M1 read-only browser → M2 writes → M3 live reconciliation).

## Architecture

```
browser ──/api──▶ Fastify server ──AWS SDK v3──▶ AWS_ENDPOINT_URL (LocalStack :4566)
(same origin)      (signs requests,               └─ real Docker containers for tasks
                    normalizes errors)
```

The browser only ever talks to its own origin, so there's no SigV4 signing or CORS pain in
the client. The server is a thin, stateless translator.

- `apps/web` — React + Vite + shadcn/ui frontend
- `apps/server` — Fastify backend (also serves the built web app in production)
- `packages/shared` — wire types + the zod task-definition schema used by both sides

## Develop

Prerequisites: Node 20+, pnpm 11, Docker (for LocalStack).

```sh
pnpm install
cp .env.example .env          # defaults point at http://localhost:4566
pnpm dev:stack                # starts LocalStack (docker-compose.dev.yml)
pnpm dev                      # web on :8080, API on :4570
```

Open <http://localhost:8080>. The clusters page and Settings are live; create a cluster from
the UI or with the AWS CLI:

```sh
aws --endpoint-url=http://localhost:4566 ecs create-cluster --cluster-name demo
```

### Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Run web + server (+ shared watcher) together |
| `pnpm dev:stack` | Start LocalStack only |
| `pnpm build` | Build shared → server → web |
| `pnpm test` | Unit tests (vitest) across all packages |
| `pnpm lint` / `pnpm typecheck` | Lint / type-check every package |

## Configuration

All server config is environment-driven (see `.env.example`) and can be changed at runtime
from the Settings page:

| Var | Default | Notes |
|---|---|---|
| `AWS_ENDPOINT_URL` | `http://localhost:4566` | LocalStack / MiniStack / Moto endpoint |
| `AWS_REGION` | `us-east-1` | |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | `test` / `test` | dummy pair for local emulators |
| `AWS_PROFILE` | — | use a named profile instead of the keys above |
| `PORT` | `4570` | backend port |

### A note on LocalStack in 2026

LocalStack now ships as a single image that expects an auth token, and its free "Hobby"
tier is non-commercial. If that doesn't fit, point `AWS_ENDPOINT_URL` at **MiniStack**
(MIT, no token, same port, real task containers) — everything in this console works against
it, except CloudWatch-Logs-based log viewing, which MiniStack doesn't implement.

## License

MIT
