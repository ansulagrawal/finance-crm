FROM oven/bun:1
WORKDIR /app

# @finance-crm/common depends on puppeteer, but this service never renders PDFs —
# skip its postinstall Chrome download entirely (that download also has no
# native linux/arm64 build, see core-api/Dockerfile for the service that
# actually needs a working one).
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Manifests first for layer caching. bun's frozen-lockfile install
# validates against every workspace member declared in the root
# package.json, not just the ones this image actually runs — every
# sibling service's package.json must be present or it fails with
# "Workspace not found", even though only reporting-api/database/common's
# source gets copied below.
COPY package.json bun.lock tsconfig.json ./
COPY reporting-api/package.json reporting-api/package.json
COPY core-api/package.json core-api/package.json
COPY integrations-api/package.json integrations-api/package.json
COPY automation-worker/package.json automation-worker/package.json
COPY database/package.json database/package.json
COPY common/package.json common/package.json

RUN bun install --frozen-lockfile

COPY database database
COPY common common
COPY reporting-api reporting-api


# Run as a non-root user. This is what lets Chrome keep its sandbox in
# core-api (see @finance-crm/common's PuppeteerPdfRenderer — it used to launch with
# --no-sandbox purely because Chrome refuses to sandbox as root, which meant
# any renderer compromise landed as root in the container), and it removes
# root from the other three for the same defence-in-depth reason. Created
# explicitly rather than reusing whatever user the base image may ship, so
# this doesn't depend on an unverified assumption about oven/bun's contents.
RUN groupadd --system --gid 1001 app \
  && useradd --system --uid 1001 --gid app --home-dir /home/app --create-home app

WORKDIR /app/reporting-api
USER app
EXPOSE 3002
CMD ["bun", "run", "start:prod"]
