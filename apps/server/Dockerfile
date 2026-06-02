# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
WORKDIR /app

RUN corepack enable \
  && corepack prepare pnpm@10.29.3 --activate

RUN apk add --no-cache git

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/package.json
COPY apps/server/tsconfig.json ./apps/server/tsconfig.json
COPY packages/typescript-config/base.json ./packages/typescript-config/base.json
COPY packages/rps-contracts/package.json ./packages/rps-contracts/package.json
COPY packages/rps-contracts/tsconfig.json ./packages/rps-contracts/tsconfig.json
COPY packages/rps-contracts/tsup.config.ts ./packages/rps-contracts/tsup.config.ts
COPY packages/rps-contracts/src ./packages/rps-contracts/src
COPY apps/server/src ./apps/server/src

RUN pnpm install --frozen-lockfile
RUN pnpm -C packages/rps-contracts run build
RUN pnpm -C apps/server run build

FROM node:24-alpine AS runtime
WORKDIR /app/apps/server

ENV NODE_ENV=production
ENV PORT=2567

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/packages /app/packages
COPY --from=build /app/apps/server/node_modules ./node_modules
COPY --from=build /app/apps/server/build ./build
COPY --from=build /app/apps/server/package.json ./package.json

EXPOSE 2567

CMD ["node", "build/index.js"]
