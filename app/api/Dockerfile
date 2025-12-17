# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /workspace

# Copy workspace-level manifests for deterministic installs
COPY package.json package-lock.json ./
COPY scripts ./scripts
COPY data ./data
COPY packages/contracts ./packages/contracts
COPY persistence ./persistence
COPY app/api/package.json app/api/package-lock.json ./app/api/
COPY app/api/tsconfig.json app/api/tsconfig.json
COPY app/api/tsconfig.build.json app/api/tsconfig.build.json

# Install root tools (used for SDE bootstrap) and shared contracts deps
RUN npm ci

# Install contracts dependencies and build distributable (source already copied)
RUN npm --prefix packages/contracts ci
RUN npm --prefix packages/contracts run build

# Install API dependencies (consumes built contracts package)
RUN npm --prefix app/api ci
COPY app/api ./app/api
COPY persistence ./persistence
RUN npm --prefix app/api run build
RUN npm --prefix app/api prune --omit=dev

FROM node:20-alpine AS prod
WORKDIR /workspace
ENV NODE_ENV=production

COPY --from=base /workspace/app/api/dist ./app/api/dist
COPY --from=base /workspace/app/api/node_modules ./app/api/node_modules
COPY --from=base /workspace/app/api/package.json ./app/api/package.json
COPY --from=base /workspace/packages/contracts ./packages/contracts
COPY --from=base /workspace/persistence ./persistence
COPY --from=base /workspace/scripts ./scripts
COPY --from=base /workspace/data ./data
COPY --from=base /workspace/node_modules ./node_modules

EXPOSE 3000

CMD ["node", "app/api/dist/index.js"]
