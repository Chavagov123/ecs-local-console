# Draft: awesome-localstack entry

Ready-to-submit contribution to
[localstack/awesome-localstack](https://github.com/localstack/awesome-localstack).
Nothing here is submitted automatically — fork that repo, apply the entry, open the PR.

## Where it goes

`README.md`, under the **GUI Clients / User Interface** section (near StackPort, GuiStack —
wherever browser/UI tools are listed), kept in the section's existing alphabetical order.

## The entry

```markdown
- [ECS Local Console](https://github.com/Chavagov123/ecs-local-console) - Dedicated GUI for LocalStack ECS: browse and manage clusters, services, tasks and task definitions, watch the scheduler reconcile live on an animated timeline, and stream CloudWatch Logs. No account, one `docker compose up`, MIT-licensed; also works against MiniStack, Moto and real AWS.
```

If that section wants a shorter line, use:

```markdown
- [ECS Local Console](https://github.com/Chavagov123/ecs-local-console) - Free, local-first ECS console with a live reconciliation view and a CloudWatch Logs viewer.
```

## Suggested PR title

`Add ECS Local Console (GUI clients)`

## Suggested PR body

> Adds **ECS Local Console** — an open-source (MIT), local-first GUI focused on **ECS**.
>
> LocalStack's own Resource Browser covers ECS, but it needs an account and runs as a hosted
> web app. This is the alternative for people who want nothing hosted: `docker compose up`
> brings it up alongside LocalStack, and it also points at MiniStack / Moto / real AWS
> unchanged.
>
> What it adds over a generic resource browser:
> - a **live reconciliation view** — watch `running` catch up to `desired` on an animated
>   gauge + an annotated event timeline (scheduler replacements, deployment completions)
> - a **CloudWatch Logs viewer** (follow / filter / per-container task logs)
> - a Form ⇄ JSON ⇄ paste-from-CLI **task-definition editor**
>
> - Repo: https://github.com/Chavagov123/ecs-local-console
> - Image: `ghcr.io/chavagov123/ecs-local-console` (multi-arch)
> - License: MIT
>
> Checked the contributing guide: entry is one line, alphabetical within its section, link
> resolves, project is public and has a license + README.
