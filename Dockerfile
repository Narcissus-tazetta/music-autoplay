FROM node:24-bookworm-slim AS builder

WORKDIR /app

# Bun is used only as the package manager/test runner; React Router/Vite SSR runs on Node.
RUN npm install -g bun@1.3.14

# Copy manifest files first to leverage Docker cache
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy only source files needed for build
COPY src ./src
COPY public ./public
COPY tsconfig.json vite.config.ts react-router.config.ts components.json ./

ENV NODE_ENV=production
RUN bun run build

# Reinstall without dev dependencies so only runtime packages reach the image.
# --ignore-scripts is required: the `prepare` script runs husky, which is a devDependency and
# is therefore absent here, and bun would fail the install with exit 127.
RUN rm -rf node_modules && bun install --frozen-lockfile --production --ignore-scripts


FROM node:24-bookworm-slim AS runtime

WORKDIR /app

# Only what the server needs at runtime. The previous `COPY --from=builder /app /app`
# shipped the entire dev dependency tree and every source file alongside the build output.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
# tsx transpiles the server entrypoint at boot, so its sources still ship.
COPY --from=builder /app/src ./src

RUN set -eux; \
	useradd -r -u 10001 -m -d /home/appuser appuser; \
	mkdir -p /app/data /app/logs; \
	chown -R 10001:10001 /app /home/appuser

USER 10001

ENV NODE_ENV=production

# The app reads PORT from the environment; the code default is 3000.
EXPOSE 3000

CMD ["./node_modules/.bin/tsx", "src/server/server.ts"]
