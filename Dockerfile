FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN yarn install --frozen-lockfile

COPY . .

ARG VERSION=
ENV APP_VERSION=${VERSION}
ENV NODE_ENV=production
RUN yarn build && \
    find dist -name "*.js.map" -type f -delete

RUN yarn install --production --frozen-lockfile --ignore-scripts && \
    yarn cache clean && \
    find /app/node_modules -type f \( -name "*.md" -o -name "*.markdown" -o -name "CHANGELOG*" -o -name "LICENSE*" -o -name "*.map" -o -name "*.tsbuildinfo" -o -name "*.d.ts" \) -delete && \
    find /app/node_modules -depth -type d \( -name "test" -o -name "tests" -o -name "__tests__" -o -name "example" -o -name "examples" \) -exec rm -rf {} + 2>/dev/null || true && \
    find /app/node_modules -depth -type d -name "doc" ! -path "*/exceljs/*" -exec rm -rf {} + 2>/dev/null || true

FROM node:20-alpine AS production

ARG VERSION=
ENV APP_VERSION=${VERSION}

WORKDIR /app

# Install PostgreSQL client for backups
RUN apk add --no-cache postgresql-client

RUN npm install -g pm2

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY docker-entrypoint.sh /usr/local/bin/
COPY ecosystem.config.js ./

RUN chmod +x /usr/local/bin/docker-entrypoint.sh && \
    rm -rf /var/cache/apk/* && \
    rm -rf /root/.npm && \
    rm -rf /tmp/*

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --spider -q http://localhost:8000/api/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"] 