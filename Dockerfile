FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY server ./server
COPY public ./public
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=5173 GARAGE_DB=/app/data/garage.sqlite
COPY --from=build /app/dist ./dist
COPY server ./server
COPY src/customization.ts src/profiles.ts ./src/
COPY package.json ./
RUN mkdir /app/data && chown node:node /app/data
USER node
EXPOSE 5173
CMD ["node", "--experimental-strip-types", "server/index.mjs"]
