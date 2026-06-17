# Bun-based image for the Anomaly Discord bot.
# The bot runs on Bun and uses the built-in `bun:sqlite` driver, so the optional
# `sqlite3` native dependency (Node-only fallback) is intentionally skipped.
FROM oven/bun:1

WORKDIR /app

# Install dependencies first for better layer caching.
# --production omits devDependencies; --omit=optional skips the Node-only sqlite3.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --omit=optional

# Copy the rest of the source. Secrets (.env), config (src/config.js) and data
# (*.sqlite, database.yml) are excluded via .dockerignore and supplied at runtime
# (env_file / bind mount / named volume) — see docker-compose.
COPY . .

ENV NODE_ENV=production

# Entry point is package.json "main" (src/index.js).
CMD ["bun", "."]
