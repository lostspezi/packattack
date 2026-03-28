# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Stage 2: Build the application
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env vars are passed from docker-compose via build args
# so the build uses the same secrets as runtime
ARG MONGODB_URI=mongodb://localhost:27017/dummy
ARG REDIS_URL=redis://localhost:6379
ARG NEXTAUTH_URL=http://localhost:3000
ARG NEXTAUTH_SECRET=dummy
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG SMTP_FROM=dummy@localhost
ARG DISCORD_CLIENT_ID=dummy
ARG DISCORD_CLIENT_SECRET=dummy
ARG TWITCH_CLIENT_ID=dummy
ARG TWITCH_CLIENT_SECRET=dummy
ARG GOOGLE_CLIENT_ID=dummy
ARG GOOGLE_CLIENT_SECRET=dummy
ARG AUTH_TRUST_HOST=true
ARG BUILD_SHA=
ARG BUILD_BRANCH=

ENV MONGODB_URI=$MONGODB_URI
ENV REDIS_URL=$REDIS_URL
ENV NEXTAUTH_URL=$NEXTAUTH_URL
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV SMTP_FROM=$SMTP_FROM
ENV DISCORD_CLIENT_ID=$DISCORD_CLIENT_ID
ENV DISCORD_CLIENT_SECRET=$DISCORD_CLIENT_SECRET
ENV TWITCH_CLIENT_ID=$TWITCH_CLIENT_ID
ENV TWITCH_CLIENT_SECRET=$TWITCH_CLIENT_SECRET
ENV GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
ENV GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET
ENV AUTH_TRUST_HOST=$AUTH_TRUST_HOST
ENV BUILD_SHA=$BUILD_SHA
ENV BUILD_BRANCH=$BUILD_BRANCH

RUN npm run build

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
