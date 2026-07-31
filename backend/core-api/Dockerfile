FROM oven/bun:1
WORKDIR /app

# Chrome for Testing (what puppeteer's own postinstall downloads) has no
# native linux/arm64 build — on an arm64 host it silently pulls the x64
# build, which then fails at runtime ("rosetta error: failed to open elf
# at /lib64/ld-linux-x86-64.so.2", no x86 emulation layer inside the
# container). Skip that download and use Debian's real native-arch
# chromium package instead — this is core-api specifically because it's
# the only service with a wired PdfRenderer consumer (the sanction-letter
# endpoint) today.
RUN apt-get update && apt-get install -y --no-install-recommends chromium \
  && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Manifests first for layer caching. bun's frozen-lockfile install
# validates against every workspace member declared in the root
# package.json, not just the ones this image actually runs — every
# sibling service's package.json must be present or it fails with
# "Workspace not found", even though only core-api/database/common's
# source gets copied below.
COPY package.json bun.lock tsconfig.json ./
COPY core-api/package.json core-api/package.json
COPY integrations-api/package.json integrations-api/package.json
COPY automation-worker/package.json automation-worker/package.json
COPY reporting-api/package.json reporting-api/package.json
COPY database/package.json database/package.json
COPY common/package.json common/package.json

RUN bun install --frozen-lockfile

COPY database database
COPY common common
COPY core-api core-api


# Run as a non-root user. This is what lets Chrome keep its sandbox in
# core-api (see @finance-crm/common's PuppeteerPdfRenderer — it used to launch with
# --no-sandbox purely because Chrome refuses to sandbox as root, which meant
# any renderer compromise landed as root in the container), and it removes
# root from the other three for the same defence-in-depth reason. Created
# explicitly rather than reusing whatever user the base image may ship, so
# this doesn't depend on an unverified assumption about oven/bun's contents.
RUN groupadd --system --gid 1001 app \
  && useradd --system --uid 1001 --gid app --home-dir /home/app --create-home app

# The local-disk storage adapter writes here (STORAGE_LOCAL_PATH), and it
# has to be writable by the non-root user. Everything else under /app stays
# root-owned and read-only to the app.
RUN mkdir -p /app/core-api/storage && chown -R app:app /app/core-api/storage

WORKDIR /app/core-api
USER app
EXPOSE 3000
CMD ["bun", "run", "start:prod"]
