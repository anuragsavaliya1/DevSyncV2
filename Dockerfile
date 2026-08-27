FROM node:22-slim

WORKDIR /app

# The managed builder injects runtime secrets. The complete committed source is
# copied so Next.js can build the App Router server and retain its dependencies.
COPY . .

RUN npm install -g corepack@latest \
  && corepack pnpm install --frozen-lockfile \
  && corepack pnpm run build

ENV NODE_ENV=production

# The platform supplies PORT at runtime; `pnpm start` runs the Next.js server.
CMD ["sh", "-c", "corepack pnpm start"]
