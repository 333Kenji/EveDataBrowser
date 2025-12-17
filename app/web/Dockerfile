FROM node:20-bullseye-slim AS base
WORKDIR /app
# Copy web package manifests
COPY app/web/package*.json ./
# Install web deps (contracts will be provided via file dependency path)
RUN npm install

# Copy and build shared contracts so the file dependency resolves
COPY packages/contracts /packages/contracts
COPY persistence /persistence
RUN npm --prefix /packages/contracts install \
  && npm --prefix /packages/contracts run build

FROM base AS build
WORKDIR /app
COPY app/web .
RUN npm run build

FROM node:20-bullseye-slim AS dev
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY app/web/package*.json ./
RUN apt-get update \
	&& npx playwright install-deps \
	&& rm -rf /var/lib/apt/lists/*
COPY app/web .
EXPOSE 5173
CMD ["npm", "run", "dev"]

FROM nginx:1.27-alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
