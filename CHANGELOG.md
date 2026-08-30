# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] — 2026-08-30

First stable release. No behaviour change over 0.4.0 — this marks the console as
feature-complete for its scope and ready to adopt.

### Added

- README screenshots (reconciliation view, task-def editor, cluster detail,
  command palette) + `docs/screenshots.md` for regenerating them.
- `CONTRIBUTING.md`, issue / PR templates, this changelog.
- A ready-to-submit `awesome-localstack` entry (`docs/awesome-localstack-entry.md`).

### Changed

- Honest positioning against LocalStack's own (now ECS-capable) Resource Browser,
  with an "Alternatives" section in the README.

## [0.4.0] — 2026-08-30

### Added

- **Light + dark theme**, system-aware, with a header toggle and a blocking
  pre-paint script so there's no flash on reload. Monaco follows the theme.
- **⌘K / Ctrl-K command palette** — jump to any cluster, task-definition family,
  or recent change; run core actions.
- **Copy as AWS CLI** on the cluster / service / task / task-definition pages,
  with `--endpoint-url` when pointed at a local emulator.
- **Revision diff** view (`/task-definitions/:family/compare`) — a side-by-side
  Monaco diff of any two revisions.
- **Inline tags editor** on all four detail pages (`TagResource` / `UntagResource`).
- **Endpoint switcher** in the header — saved endpoints in `localStorage`.

## [0.3.0] — 2026-08-30

### Added

- **Live reconciliation view** — a per-service tab backed by a server-side
  `GET /api/events` SSE stream. An animated desired-vs-running gauge (with
  blue/green sub-bars) and an annotated event timeline ("scheduler replaced task
  `abc123`", "deployment of `web:4` completed"). Falls back to polling when the
  stream drops.
- **CloudWatch Logs viewer** — a `/logs` page (group list, follow, filter, time
  range, load-older) and a per-container **Logs** tab on each task. Non-`awslogs`
  containers get an inline hint instead of a viewer.
- Task **Network** tab now hydrates real ENI data (private IP/DNS, subnet, VPC,
  security groups) for `awsvpc` tasks.
- **Container instances** page, linked from the cluster view.
- Multi-arch image: `linux/amd64` **and** `linux/arm64`.

### Changed

- Fastify runs with `forceCloseConnections` so a live SSE socket can't stall a
  graceful shutdown.

## [0.2.0] — 2026-08-30

### Added

- **Write UI** for every endpoint that shipped headless in 0.1.0: create / scale
  / update / delete services (with an optimistic desired-count stepper), run and
  stop tasks, and a **Form ⇄ JSON ⇄ paste-from-CLI** task-definition editor
  (Monaco, lazy-loaded).
- Networking pickers for subnets / security groups / IAM roles, with a
  "type an id" fallback when the emulator doesn't implement `ec2:DescribeSubnets`.
- `useMutationToast` helper; MSW-based frontend test harness.

### Changed

- Route-level code-splitting (each page in its own chunk).
- Task-definition listings behind a 30s TTL (was an unbounded N+1 on every tab).
- Bad query filters return `400`, not `500`.

## [0.1.0] — 2026-08-29

### Added

- Read-only browser: clusters, services (deployments / events / tasks), tasks
  (containers / network / raw JSON, stopped-reason surfaced), task-definition
  families → revisions → JSON.
- Fastify backend with a `List*`→`Describe*` + TTL-cache read pattern, normalized
  error envelopes, runtime-switchable endpoint, health/connection probe.
- A tested write API (no UI yet) and an 8-step Moto lifecycle test.
- `docker compose up` bundling the console with LocalStack; public GHCR image.

[Unreleased]: https://github.com/Chavagov123/ecs-local-console/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Chavagov123/ecs-local-console/compare/v0.4.0...v1.0.0
[0.4.0]: https://github.com/Chavagov123/ecs-local-console/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Chavagov123/ecs-local-console/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Chavagov123/ecs-local-console/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Chavagov123/ecs-local-console/releases/tag/v0.1.0
