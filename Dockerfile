# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV CI=true
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @ecs-local-console/shared build \
 && pnpm --filter @ecs-local-console/server build \
 && pnpm --filter @ecs-local-console/web build

# `pnpm deploy --legacy` flattens the server package + its prod dependencies
# (including the built @ecs-local-console/shared workspace package) into one
# self-contained tree with a hoisted node_modules.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter @ecs-local-console/server deploy --prod --legacy /out \
 && cp -r apps/web/dist /out/public

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out ./
ENV PORT=4570
ENV WEB_DIR=/app/public
EXPOSE 4570
CMD ["node", "dist/index.js"]
