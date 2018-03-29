#!/usr/bin/env bash

docker run -it --rm \
    -v "$PWD":/app \
    -w /app \
    --env NODE_ENV=test \
    --env REDIS_HOST=redis \
    --init \
    --network test-net \
    node:9.9.0-alpine \
    npx $@
