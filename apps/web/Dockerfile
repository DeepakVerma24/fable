FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate
COPY . .
RUN pnpm install --frozen-lockfile
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @fable/web build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3847
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3847
CMD ["node", "apps/web/server.js"]
