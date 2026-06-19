FROM node:24-bookworm-slim AS builder

WORKDIR /app

# Bun is used only as the package manager/test runner; React Router/Vite SSR runs on Node.
RUN npm install -g bun@1.3.14

# Copy manifest files first to leverage Docker cache
COPY package.json bun.lock ./

# Install dependencies with frozen lockfile
RUN bun install --frozen-lockfile

# Copy only source files needed for build
COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY tsconfig.json vite.config.ts react-router.config.ts components.json ./

# Build the application
ENV NODE_ENV=production
RUN bun run build

FROM node:24-bookworm-slim AS runtime

WORKDIR /app

# Copy the built artifacts and all files from builder
COPY --from=builder /app /app

# Create a dedicated, non-root user and set ownership for /app
RUN set -eux; \
	if command -v useradd >/dev/null 2>&1; then \
		useradd -r -u 10001 -m -d /home/appuser appuser; \
	elif command -v adduser >/dev/null 2>&1; then \
		adduser -D -u 10001 appuser; \
	else \
		# Fallback: create passwd entry and home directory
		mkdir -p /home/appuser; \
		echo 'appuser:x:10001:10001::/home/appuser:/sbin/nologin' >> /etc/passwd; \
	fi; \
	chown -R 10001:10001 /app /home/appuser || true

# Drop to non-root user if created
USER 10001

# Production env
ENV NODE_ENV=production

# The app uses a port set via environment (PORT).
# Default in code is 3000, but Koyeb/Render may override via env.
EXPOSE 3000

CMD ["./node_modules/.bin/tsx", "src/server/server.ts"]
