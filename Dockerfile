# syntax=docker/dockerfile:1

FROM node:20-bullseye-slim AS base
WORKDIR /workspace

# Workspace manifests and shared assets
COPY package.json package-lock.json ./
COPY scripts ./scripts
COPY packages/contracts ./packages/contracts
COPY persistence ./persistence

# API manifests
COPY app/api/package.json app/api/package-lock.json ./app/api/
COPY app/api/tsconfig.json app/api/tsconfig.json
COPY app/api/tsconfig.build.json app/api/tsconfig.build.json

# Web manifests
COPY app/web/package.json app/web/package-lock.json ./app/web/

# Install root + shared deps
RUN npm ci
RUN npm --prefix packages/contracts ci
RUN npm --prefix packages/contracts run build

# Install API + web deps
RUN npm --prefix app/api ci
RUN npm --prefix app/web ci

# Copy source
COPY app/api ./app/api
COPY app/web ./app/web

# Build web + API
RUN npm --prefix app/web run build
RUN npm --prefix app/api run build
RUN npm --prefix app/api prune --omit=dev

FROM node:20-bullseye-slim AS prod
WORKDIR /workspace
ENV NODE_ENV=production

COPY --from=base /workspace/app/api/dist ./app/api/dist
COPY --from=base /workspace/app/api/node_modules ./app/api/node_modules
COPY --from=base /workspace/app/api/package.json ./app/api/package.json
COPY --from=base /workspace/app/web/dist ./app/web/dist
COPY --from=base /workspace/packages/contracts ./packages/contracts
COPY --from=base /workspace/persistence ./persistence
COPY --from=base /workspace/scripts ./scripts
COPY --from=base /workspace/node_modules ./node_modules
COPY --from=base /workspace/package.json ./package.json
COPY --from=base /workspace/package-lock.json ./package-lock.json

EXPOSE 3000

CMD ["node", "app/api/dist/index.js"]
