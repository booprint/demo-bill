FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY lib ./lib
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/lib ./lib
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
EXPOSE 8082
CMD ["node", "dist/index.js"]
