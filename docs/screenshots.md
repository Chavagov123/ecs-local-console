# Regenerating the screenshots

The images in `docs/img/` are checked in. To refresh them — or to capture the animated
reconciliation GIF, which needs a **real scheduler** running task containers:

## Against LocalStack (recommended — shows tasks actually starting)

```sh
docker compose -f docker-compose.dev.yml up      # LocalStack with the docker socket
pnpm dev                                          # web :8080, API :4570

# seed something with a running service
aws --endpoint-url http://localhost:4566 ecs create-cluster --cluster-name demo
aws --endpoint-url http://localhost:4566 ecs register-task-definition \
  --family web --network-mode bridge --requires-compatibilities EC2 \
  --container-definitions '[{"name":"app","image":"nginx:1.27-alpine","essential":true,"memory":256,"portMappings":[{"containerPort":80}]}]'
aws --endpoint-url http://localhost:4566 ecs create-service \
  --cluster demo --service-name web-svc --task-definition web:1 --desired-count 3 --launch-type EC2
```

Then open `http://localhost:8080/clusters/demo/services/web-svc?tab=reconciliation`, start a
screen recording, and scale the service (the `− N +` stepper in the header, or
`update-service --desired-count`). LocalStack's scheduler will start/stop real containers and
the gauge + timeline animate. Export the recording as `docs/img/reconciliation.gif` and add
it to the README.

## Against Moto (no Docker — what the current stills use)

```sh
python -m moto.server -p 5001
AWS_ENDPOINT_URL=http://localhost:5001 pnpm dev
```

Moto implements the ECS API but never launches containers, so `runningCount` stays 0 and the
gauge shows everything as "pending / to start". Fine for UI stills, not for the GIF.

## The shots

| File | Page | Notes |
|---|---|---|
| `reconciliation.jpg` | `/clusters/demo/services/web-svc?tab=reconciliation` | light theme |
| `reconciliation-dark.jpg` | same | dark theme |
| `task-def-editor.jpg` | `/task-definitions/web/2/edit` | Form mode |
| `cluster-light.jpg` | `/clusters/demo` | services + tags |
| `command-palette.jpg` | any page, press ⌘K / Ctrl-K | |

Viewport 1568×708. Toggle the theme from the header (sun/moon) or `localStorage.theme`.
