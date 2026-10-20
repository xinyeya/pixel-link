FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=4178
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/scripts/library.js ./scripts/library.js
RUN mkdir -p /app/.data && chown node:node /app/.data
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/public ./public
COPY --from=build /app/native ./native
COPY --from=build /app/licenses ./licenses
COPY --from=build /app/COPYING /app/THIRD_PARTY_NOTICES.md /app/README.md ./
USER node
EXPOSE 4178
CMD ["node", "server/index.js"]
