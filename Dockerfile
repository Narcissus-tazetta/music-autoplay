FROM oven/bun:1.2.13@sha256:a02c6162266611419fd84c8f96dbdbf3029532e2491314dee5172a27223e5428 AS build
WORKDIR /app
COPY bun.lock package.json tsconfig.json ./
RUN bun i --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1.2.13@sha256:a02c6162266611419fd84c8f96dbdbf3029532e2491314dee5172a27223e5428
WORKDIR /app
COPY --from=build /app /app
CMD [ "bun", "start" ]