# TestMate AI for Render (free web service) with Litestream continuous backup to Backblaze B2.
# Local development does not use this file; see README.md. Deployment guide: DEPLOY.md.
FROM node:26.13.0-bookworm-slim

# Litestream, pinned and checksum-verified (release v0.5.17, 31 Aug 2026).
ARG LITESTREAM_VERSION=0.5.17
ARG LITESTREAM_SHA256=cfb371176d164437ae869f8351cfde49bd1804ae71c61923f75c9cba9c9c006d
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && curl -fsSL -o /tmp/litestream.tar.gz \
      "https://github.com/benbjohnson/litestream/releases/download/v${LITESTREAM_VERSION}/litestream-${LITESTREAM_VERSION}-linux-x86_64.tar.gz" \
 && echo "${LITESTREAM_SHA256}  /tmp/litestream.tar.gz" | sha256sum -c - \
 && mkdir /tmp/litestream \
 && tar -xzf /tmp/litestream.tar.gz -C /tmp/litestream \
 && find /tmp/litestream -type f -name litestream -exec install -m 0755 {} /usr/local/bin/litestream \; \
 && rm -rf /tmp/litestream /tmp/litestream.tar.gz \
 && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/* \
 && litestream version

WORKDIR /app

# Install dependencies first so they are cached between builds. The root package.json's allowScripts
# policy skips better-sqlite3's compile step; its prebuilt Linux binary is used.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --include=dev

COPY . .
RUN npm run build

# The database lives on the container's temporary disk and is restored from B2 at every start.
# This image is only for the online deployment, so public mode is on by default (start.sh also
# refuses to start without it). Local development does not use this file.
ENV TESTMATE_DB_PATH=/var/data/testmate.db \
    TESTMATE_API_PORT=10000 \
    TESTMATE_PUBLIC_MODE=1
RUN mkdir -p /var/data && chown node:node /var/data

USER node
EXPOSE 10000
CMD ["sh", "deploy/render/start.sh"]
