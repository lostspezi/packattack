# Beta Deployment Design Spec

**Date:** 2026-03-25
**Status:** Draft
**Scope:** Docker production build, Nginx reverse proxy, SSL, GitHub CI/CD, Resend email

## Overview

Deploy PackAttack.gg to `beta.packattack.gg` via Docker on an existing server. GitHub Action triggers on push to `beta` branch, SSHs into the server, generates `.env.beta` from GitHub Secrets, pulls latest code, and rebuilds containers.

## Architecture

```
GitHub (push to beta branch)
  → GitHub Action: SSH → write .env.beta → git pull → docker compose up --build

Server (beta.packattack.gg):
  ┌─ nginx (80/443, SSL via Let's Encrypt)
  │   └─ reverse proxy → nextjs:3000
  ├─ nextjs (multi-stage Docker build)
  ├─ mongo (persistent volume, internal only)
  ├─ redis (internal only)
  └─ certbot (cert renewal)
```

## Files

```
Dockerfile                          # Multi-stage Next.js production build
docker-compose.beta.yml             # All services for beta deployment
nginx/
  nginx.conf                        # Main nginx config
  conf.d/
    beta.conf                       # Server block for beta.packattack.gg
.github/
  workflows/
    deploy-beta.yml                 # GitHub Action
```

## Dockerfile (Multi-stage)

1. **deps** — `node:20-alpine`, install dependencies (`npm ci`)
2. **builder** — copy source, `npm run build`
3. **runner** — `node:20-alpine`, copy built `.next/standalone` + `.next/static` + `public`, run `node server.js`

Requires `output: "standalone"` in `next.config.ts`.

## docker-compose.beta.yml

### Services

**nextjs:**
- Build from `Dockerfile`
- `env_file: .env.beta`
- Internal port 3000
- Depends on: mongo, redis
- Restart: always

**mongo:**
- Image: `mongo:8`
- Volume: `mongo_data:/data/db`
- No exposed ports (internal only)
- Restart: always

**redis:**
- Image: `redis:7.4-alpine`
- No exposed ports (internal only)
- Restart: always

**nginx:**
- Image: `nginx:alpine`
- Ports: 80, 443
- Volumes: `./nginx/nginx.conf`, `./nginx/conf.d/`, certbot webroot, SSL certs
- Depends on: nextjs
- Restart: always

**certbot:**
- Image: `certbot/certbot`
- Volumes: shared with nginx (webroot + certs)
- Entrypoint: sleep + renewal loop (every 12h)

### Volumes
- `mongo_data` (persistent)
- `certbot_www` (webroot challenge)
- `certbot_certs` (SSL certificates)

## Nginx Config

### nginx.conf
Minimal main config: worker processes, events, http block including conf.d/*.conf.

### conf.d/beta.conf

**Port 80:** Redirect all traffic to HTTPS, except `/.well-known/acme-challenge/` for Let's Encrypt.

**Port 443:** SSL with Let's Encrypt certs. Proxy pass to `http://nextjs:3000`. WebSocket support headers. Standard proxy headers (X-Real-IP, X-Forwarded-For, X-Forwarded-Proto).

Initial setup: Before first cert exists, nginx starts with HTTP-only config. Certbot obtains cert, then nginx reloads with SSL.

## GitHub Action (deploy-beta.yml)

**Trigger:** Push to `beta` branch

**Steps:**
1. SSH into server using `SERVER_HOST`, `SERVER_USER`, `SERVER_PASSWORD`
2. Generate `.env.beta` from GitHub Secrets + hardcoded values:
   - Secrets: `NEXTAUTH_SECRET`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `RESEND_API_KEY`
   - Hardcoded: `MONGODB_URI=mongodb://mongo:27017/packattackgg`, `REDIS_URL=redis://redis:6379`, `NEXTAUTH_URL=https://beta.packattack.gg`, `NEXT_PUBLIC_APP_URL=https://beta.packattack.gg`, `SMTP_FROM=no-reply@mail.packattack.gg`
3. `cd /opt/packattackgg-beta && git pull origin beta`
4. `docker compose -f docker-compose.beta.yml up --build -d`

**GitHub Secrets required:**
```
SERVER_HOST
SERVER_USER
SERVER_PASSWORD
NEXTAUTH_SECRET
DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET
TWITCH_CLIENT_ID
TWITCH_CLIENT_SECRET
RESEND_API_KEY
```

## Email: Resend

Replace Nodemailer SMTP transport with Resend SDK.

- Install `resend` package
- Modify `lib/mail.ts`: use Resend API instead of Nodemailer
- Env var: `RESEND_API_KEY`
- From address: `no-reply@mail.packattack.gg`
- Keep MailDev for local dev (detect env: if `RESEND_API_KEY` exists use Resend, otherwise use Nodemailer/SMTP)

## First-Time Server Setup (manual)

```bash
mkdir -p /opt/packattackgg-beta
cd /opt/packattackgg-beta
git clone <repo-url> .
git checkout beta

# First deploy will be triggered by GitHub Action
# For SSL, certbot needs to run after nginx starts on port 80:
docker compose -f docker-compose.beta.yml up -d nginx
docker compose -f docker-compose.beta.yml run --rm certbot certonly --webroot -w /var/www/certbot -d beta.packattack.gg --email admin@packattack.gg --agree-tos --non-interactive
docker compose -f docker-compose.beta.yml up -d
```

## next.config.ts Changes

Add `output: "standalone"` for Docker deployment:

```typescript
const nextConfig: NextConfig = {
  output: "standalone",
};
```
