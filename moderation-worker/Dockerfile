# NSFWJS needs tfjs-node's native bindings — Debian slim has the glibc they
# expect (Alpine/musl does not build tfjs-node cleanly). Node 22+ for the
# built-in WebSocket that supabase-js's realtime client requires.
FROM node:22-slim

WORKDIR /app

# Build tools for the tfjs-node native addon.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --omit=dev

COPY worker.js ./

# --no-deprecation silences the harmless util.isNullOrUndefined warning from a
# transitive dependency; it is not our code and not actionable.
CMD ["node", "--no-deprecation", "worker.js"]
