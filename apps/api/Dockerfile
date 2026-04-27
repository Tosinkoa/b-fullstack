FROM node:24-slim

WORKDIR /repo

# Railpack install (for building deployed apps; no Dockerfiles for those images)
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl bash docker.io git \
  && rm -rf /var/lib/apt/lists/*

# Installs the `railpack` CLI into the image.
RUN curl -sSL https://railpack.com/install.sh | bash
RUN railpack --version

# Workspace install (copy only manifests first for caching)
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/ ./.yarn/
COPY apps/api/package.json apps/api/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/sample-app/package.json apps/sample-app/package.json

RUN corepack enable && yarn install --immutable

COPY apps/api apps/api

RUN yarn workspace @app/api build

# Workspace context for Railpack builds at runtime (default SAMPLE_APP_SOURCE_PATH is the monorepo root).
COPY apps/sample-app apps/sample-app

EXPOSE 3000

CMD ["node", "apps/api/dist/main.js"]

