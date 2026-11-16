#!/bin/sh
set -eu
DATA_DIR="${FARZIN_DATA_DIR:-/data}"
mkdir -p "$DATA_DIR"
chown -R node:node "$DATA_DIR"
exec su-exec node node server.js
