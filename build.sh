#!/bin/bash

# Strict mode
set -euo pipefail

# Compile typescript
tsc

# Compile sass
sass --no-source-map src/styles:build/styles

# Copy assets
rm -rf build/assets
cp -r src/assets build/assets
