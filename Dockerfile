# ---------- Base ----------
FROM node:18-alpine AS base

WORKDIR /app

# ---------- Dependencies ----------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---------- Build ----------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate

# ---------- Production ----------
FROM node:18-alpine AS prod

WORKDIR /app

ENV NODE_ENV=production

# Copy only what we need
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY --from=build /app/package.json ./package.json

EXPOSE 5000

CMD ["node", "src/server.js"]
