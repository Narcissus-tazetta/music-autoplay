FROM oven/bun:1

# Create non-root user for security
RUN adduser -D -u 10001 appuser

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

COPY . .

# Change ownership to appuser
RUN chown -R appuser:appuser /app

ENV NODE_ENV=production

# Switch to non-root user before build and runtime
USER 10001

RUN bun run build

EXPOSE 10000

CMD ["bun", "run", "start"]
