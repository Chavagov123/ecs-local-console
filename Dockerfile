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

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Copy the installed workspace (pnpm's node_modules is mostly symlinks into the
# store, so the whole tree has to travel together) plus the build outputs.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/server/package.json ./apps/server/
COPY --from=build /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist
ENV PORT=4570
ENV WEB_DIR=/app/apps/web/dist
EXPOSE 4570
CMD ["node", "apps/server/dist/index.js"]
