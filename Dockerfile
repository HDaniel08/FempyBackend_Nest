# ---- Base ----
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

# ---- Dependencies ----
FROM base AS deps
COPY package*.json ./
RUN npm ci --ignore-scripts

# ---- Build ----
FROM deps AS build
COPY . .

# Prisma generate-hez kell egy placeholder DATABASE_URL build időben is,
# különben a prisma config elhasalhat.
ARG DATABASE_URL="postgresql://user:pass@localhost:5432/app"
ENV DATABASE_URL=$DATABASE_URL

RUN npx prisma generate
RUN npm run build

# ---- Production runner ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000

CMD ["node", "dist/src/main.js"]
