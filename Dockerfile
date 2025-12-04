FROM oven/bun:1.1
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build
EXPOSE 10000
CMD ["bun", "run", "start"]
