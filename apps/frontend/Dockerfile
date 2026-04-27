FROM node:24-slim

WORKDIR /repo

# Workspace install (copy only manifests first for caching)
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/ ./.yarn/
COPY apps/api/package.json apps/api/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/sample-app/package.json apps/sample-app/package.json

RUN corepack enable && yarn install --immutable

COPY apps/frontend apps/frontend

RUN yarn workspace @app/frontend build

EXPOSE 4173

CMD ["yarn", "workspace", "@app/frontend", "preview", "--host", "0.0.0.0", "--port", "4173"]

