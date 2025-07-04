FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN yarn install --frozen-lockfile

COPY . .

ENV NODE_ENV=production
RUN yarn build && \
    find dist -name "*.js.map" -type f -delete

RUN yarn install --production --frozen-lockfile && \
    yarn cache clean

FROM node:20-alpine AS production

WORKDIR /app

# Install PostgreSQL client for backups
RUN apk add --no-cache postgresql-client

RUN yarn global add pm2

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