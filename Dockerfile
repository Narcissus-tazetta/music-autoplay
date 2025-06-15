FROM node:18-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm cache clean --force
RUN rm -rf node_modules package-lock.json
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/app ./app
EXPOSE 3000
CMD [ "npm", "start" ]