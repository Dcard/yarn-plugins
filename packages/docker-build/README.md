# yarn-plugin-docker-build

Build a Docker image for a workspace.

## Installation

Install the latest plugin.

```sh
yarn plugin import https://github.com/Dcard/yarn-plugins/releases/latest/download/plugin-docker-build.js
```

## Dockerfile

The following is a basic example of `Dockerfile`.

```dockerfile
FROM node:18-alpine AS builder

# Install dependencies for building native libraries
RUN apk add --update git openssh-client python make gcc g++

WORKDIR /workspace

# docker-build plugin copies everything needed for `yarn install` to `manifests` folder.
COPY manifests ./

RUN yarn install --immutable

# You can delete the cache folder after `yarn install` is done.
RUN rm -rf .yarn/cache

FROM node:18-alpine

WORKDIR /workspace

# Copy the installed dependencies from the previous stage.
COPY --from=builder /workspace ./

# docker-build plugin runs `yarn pack` in all workspace dependencies and copies them to `packs` folder.
COPY packs ./

CMD yarn workspace @foo/bar start
```

## CLI

### `yarn docker build`

This command will build a efficient Docker image which only contains production dependencies for the specified workspace.

You have to create a `Dockerfile` in your workspace or your project. You can also specify the path to Dockerfile using the `-f, --file` option.

Additional arguments can be passed to `docker build` directly, please check the Docker docs for more info: https://docs.docker.com/engine/reference/commandline/build/

Example:

```sh
yarn docker build @foo/bar
yarn docker build @foo/bar -t image-tag
yarn docker build --copy secret.key --copy config.json @foo/bar
```

#### `-f,--file`

Path to `Dockerfile`. Default to the Dockerfile in the workspace or the project.

#### `--copy`

Copy additional files to a Docker image. This is useful for secret keys or configuration files. The files will be copied to `manifests` folder. The path can be either a path relative to the Dockerfile or an absolute path.

#### `--production`

Install production dependencies only.
