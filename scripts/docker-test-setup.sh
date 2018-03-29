#!/usr/bin/env bash

docker network create --driver bridge test-net
docker run -d --rm --name redis --network test-net redis:3.2.11-alpine
