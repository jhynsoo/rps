# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
WORKDIR /app

RUN corepack enable \
  && corepack prepare pnpm@10.29.3 --activate

RUN apk add --no-cache git

COPY package.json tsconfig.json ./
COPY src ./src

RUN pnpm install
RUN pnpm run build

FROM node:24-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=2567

COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules

EXPOSE 2567

CMD ["node", "build/index.js"]
