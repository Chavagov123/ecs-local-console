# ECS Local Console

A GUI for **[LocalStack](https://localstack.cloud) ECS** — browse and manage clusters,
services, tasks, and task definitions, and watch the scheduler reconcile in real time.

Works against anything that speaks the AWS ECS API on a configurable endpoint:
**LocalStack**, **[MiniStack](https://ministack.org)** (MIT-licensed, fully free), Moto, or
real AWS.

> Why this exists: LocalStack's own **Resource Browser** does cover ECS now — but it needs a
> LocalStack account and runs as a hosted web app. This is the local-first alternative:
> **no account, one `docker compose up`, MIT-licensed and forkable**, with an ECS-specific
> read/write/observe experience — including a **live reconciliation view** (watch the
> scheduler drive `running` toward `desired`) that doesn't exist anywhere else. It also
> points at MiniStack, Moto, or real AWS unchanged.

## Status

**v0.2.0 — full read + write.** ([changelog](https://github.com/Chavagov123/ecs-local-console/releases))

Working today:

- **Clusters** — list + detail (services / tasks tabs), create & delete
- **Services** — detail (overview / deployments / events / tasks); create; a debounced
  desired-count stepper (optimistic — the number moves instantly and rolls back on error);
  change-revision dialog; force new deployment; delete with force. Adaptive polling speeds
  up while a deployment rolls out
- **Tasks** — detail (containers / network / raw JSON, stopped-reason surfaced); run a
  standalone task (partial-placement `failures[]` shown); stop a task
- **Task definitions** — families → revisions → JSON; a **Form ⇄ JSON ⇄ paste-from-CLI
  editor** (Monaco, lazy-loaded); "edit as new revision"; deregister
- Networking pickers for subnets / security groups / IAM roles (with a "type an id"
  fallback when the emulator doesn't implement `ec2:DescribeSubnets`)
- Cross-cluster task list; endpoint settings + connection test
- Concept tooltips (what `PROVISIONING` means, why the scheduler replaced a task)

Every write is covered by a lifecycle test against a real ECS API (moto) in CI.

**Not yet:** a live SSE reconciliation stream + animated view, a CloudWatch Logs viewer
(both v0.3.0); light/dark theme + ⌘K palette + copy-as-CLI (v0.4.0).

## Alternatives

- **[LocalStack Resource Browser](https://app.localstack.cloud)** — LocalStack's own web app.
  Covers ECS (clusters, task definitions, services, tasks) plus every other service, and it's
  the right choice if you're fine signing in and you want one browser for your whole stack.
  Requires a LocalStack account; hosted (your browser talks to `app.localstack.cloud`).
- **LocalStack Desktop / Docker extension** — paid, LocalStack-only.
- **StackPort, GuiStack** — free open-source stack browsers, but no ECS coverage.

Reach for **this** when you want: no account and nothing hosted, an ECS-focused view
(deployment timeline, decoded stopped-reasons, a task-def editor, the reconciliation view),
the same console across LocalStack / MiniStack / Moto / real AWS, or a codebase you can fork.

## Run it

Needs Docker (LocalStack runs ECS tasks as real containers — see below).

```sh
curl -O https://raw.githubusercontent.com/Chavagov123/ecs-local-console/main/docker-compose.yml
docker compose up
```

Open <http://localhost:4570>. This brings up LocalStack + the console together; the image
is `ghcr.io/chavagov123/ecs-local-console` (`:latest` or a pinned `:0.2.0`).

## How it works

The console **never touches Docker.** It's a pure ECS-API client — the same API you'd call
against real AWS. LocalStack is the ECS control plane *and* it drives your Docker engine as
the compute:

```
┌─ your Docker engine ─────────────────────────────────────────────┐
│  ┌───────────┐   ┌───────────────┐   task containers LocalStack   │
│  │ localstack│◄──┤ ecs-local-    │   starts (siblings, in         │
│  │ ECS :4566 │   │ console :4570 │   `docker ps`):                │
│  │ + scheduler│  │ AWS SDK v3    │   ┌─────┐ ┌─────┐ ┌─────┐       │
│  │     │      │  └──────▲────────┘   │nginx│ │nginx│ │nginx│       │
│  │     │ docker run     │ /api       └─────┘ └─────┘ └─────┘       │
│  │     ▼                │                ▲                         │
│  │  docker.sock ────────┼────────────────┘ docker run             │
│  └───────────┘          │ browser                                 │
└────────────────────────┼─────────────────────────────────────────┘
                    localhost:4570
```

1. You (or Terraform, or `aws ecs`) call `CreateService` / `RunTask` against LocalStack.
2. LocalStack's ECS scheduler reconciles `running` toward `desiredCount` and, for each task,
   translates the task definition (`image`, `memory`, `portMappings`, env, `awslogs`) into a
   `docker run` on your host's Docker engine — via the mounted `/var/run/docker.sock`.
3. Those task containers are **siblings** of the LocalStack container, visible in `docker ps`.
   `awslogs`-configured containers have their stdout tailed into LocalStack's CloudWatch Logs.
4. The console polls `DescribeServices` / `ListTasks` and renders the state; its write actions
   (`UpdateService`, `StopTask`, …) go back through the same ECS API.

So task execution never goes through the console — it only reads and steers LocalStack's ECS
state. The one requirement is that **LocalStack** has `/var/run/docker.sock` mounted (the
compose file does this); the console needs no Docker access and no privileges.

## Architecture

```
browser ──/api──▶ Fastify server ──AWS SDK v3──▶ AWS_ENDPOINT_URL
(same origin)      (signs requests,
                    normalizes errors,
                    serves the built SPA)
```

The browser only ever talks to its own origin — no SigV4 signing, no CORS against
LocalStack. The server is a thin, stateless translator.

- `apps/web` — React + Vite + shadcn/ui; react-query is the whole state layer; route-level
  code-splitting
- `apps/server` — Fastify + AWS SDK v3; a `List*→Describe*` hydration + TTL-cache pattern for
  reads, `cache.invalidate(prefix)` for writes; also serves the built SPA in production
- `packages/shared` — wire types + the zod task-definition schema, imported by both sides

## Develop

Prerequisites: Node 22+, pnpm 11, Docker (for LocalStack).

```sh
pnpm install
cp .env.example .env          # defaults point at http://localhost:4566
pnpm dev:stack                # starts LocalStack (docker-compose.dev.yml)
pnpm dev                      # web on :8080, API on :4570
```

Open <http://localhost:8080>. Create a cluster + service from the UI, or seed one with the
AWS CLI:

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
| `RUN_INTEGRATION=1 AWS_ENDPOINT_URL=… pnpm --filter @ecs-local-console/server test:integration` | Lifecycle test against a live emulator (CI uses `moto`) |

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
it. (The CloudWatch Logs viewer landing in v0.3.0 will need LocalStack's `awslogs`
integration; MiniStack ignores the log driver.)

## License

MIT
