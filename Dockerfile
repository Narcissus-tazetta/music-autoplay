FROM oven/bun:1 AS builder

WORKDIR /app

# Copy manifest files first to leverage Docker cache
COPY package.json bun.lockb ./

# Install dependencies in builder stage
RUN bun install --frozen-lockfile

# Copy the rest of the source
COPY . .
ENV NODE_ENV=production
RUN bun run build

FROM oven/bun:1 AS runtime

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

# The app uses a port set via environment (PORT). Default in code is 3000,
# but render.yaml uses 10000; EXPOSE for documentation only.
EXPOSE 10000

CMD ["bun", "run", "start"]
